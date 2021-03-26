import os.path as osp
from os import makedirs
import argparse
import json
import numpy as np
from umap import UMAP

import torch
import torch.nn.functional as F
from sklearn.metrics import roc_auc_score

from torch_geometric.utils import negative_sampling
from torch_geometric.datasets import Planetoid
from torch_geometric.data import InMemoryDataset, Data
import torch_geometric.transforms as T
from torch_geometric.nn import GCNConv
from torch_geometric.utils import train_test_split_edges


class MyImdbAndYelpDataset(InMemoryDataset):
    def __init__(self, root, transform=None, pre_transform=None):
        super(MyImdbAndYelpDataset, self).__init__(root, transform, pre_transform)
        self.data, self.slices = torch.load(self.processed_paths[0])

    @property
    def raw_file_names(self):
        return ['graph.json', 'attr-meta.json'] 

    @property
    def processed_file_names(self):
        return ['data.pt']

    def process(self):
        print(self.raw_paths)
        # assuming a bipartite graph movie-user, or restaurant-user
        with open(osp.join(self.raw_dir, 'graph.json')) as f:
            json_graph = json.load(f)
            nodes = json_graph['nodes']
            sources = [min(e['source'], e['target']) for e in json_graph['links']]
            targets = [max(e['source'], e['target']) for e in json_graph['links']]
            edge_index = torch.tensor([sources, targets], dtype=torch.long)
        edge_dict = {}
        for n in nodes:
            edge_dict[n['id']] = {}
        for i, s in enumerate(sources):
            edge_dict[s][targets[i]] = True
            
        user_nodes = []
        other_nodes = []
        for n in nodes:
            if n['type'] == 'user':
                user_nodes.append(n['id'])
            else:
                other_nodes.append(n['id'])
        print('node type number: ', len(user_nodes), len(other_nodes))
        allow_node_pairs = [[other, user] for other in other_nodes for user in user_nodes]
        unseen_edges = filter(lambda p: not edge_dict[min(p)].get(max(p), False), allow_node_pairs)

        with open(osp.join(self.raw_dir, 'attr-meta.json')) as f:
            attr_data = json.load(f)
            features = [[float(row[a['name']]) if a['nodeType'] == row['type'] else 0.0 for a in attr_data] for row in nodes]
            features = torch.tensor(features, dtype=torch.float32)

        d = Data(x=features, edge_index=edge_index, 
            allow_node_pairs=torch.tensor(allow_node_pairs, dtype=torch.long).t(), 
            unseen_edges=torch.tensor(list(unseen_edges), dtype=torch.long).t())
        torch.save(self.collate([d]), self.processed_paths[0])



class Net(torch.nn.Module):
    def __init__(self):
        super(Net, self).__init__()
        self.conv1 = GCNConv(dataset.num_features, 64)
        self.conv2 = GCNConv(64, 16)

    def encode(self):
        x = self.conv1(data.x, data.train_pos_edge_index)
        x = x.relu()
        return self.conv2(x, data.train_pos_edge_index)

    def decode(self, z, pos_edge_index, neg_edge_index):
        edge_index = torch.cat([pos_edge_index, neg_edge_index], dim=-1)
        logits = (z[edge_index[0]] * z[edge_index[1]]).sum(dim=-1)
        return logits

    def decode_all(self, z):
        prob_adj = z @ z.t()
        return (prob_adj > 0).nonzero(as_tuple=False).t()



def get_link_labels(pos_edge_index, neg_edge_index):
    E = pos_edge_index.size(1) + neg_edge_index.size(1)
    link_labels = torch.zeros(E, dtype=torch.float, device=device)
    link_labels[:pos_edge_index.size(1)] = 1.
    return link_labels


def train():
    model.train()

    neg_edge_index = negative_sampling(
        edge_index=data.train_pos_edge_index, num_nodes=data.num_nodes,
        num_neg_samples=data.train_pos_edge_index.size(1))

    optimizer.zero_grad()
    z = model.encode()
    link_logits = model.decode(z, data.train_pos_edge_index, neg_edge_index)
    link_labels = get_link_labels(data.train_pos_edge_index, neg_edge_index)
    loss = F.binary_cross_entropy_with_logits(link_logits, link_labels)
    loss.backward()
    optimizer.step()

    return loss

@torch.no_grad()
def test():
    model.eval()
    perfs = []
    for prefix in ["val", "test"]:
        pos_edge_index = data[f'{prefix}_pos_edge_index']
        neg_edge_index = data[f'{prefix}_neg_edge_index']

        z = model.encode()
        link_logits = model.decode(z, pos_edge_index, neg_edge_index)
        link_probs = link_logits.sigmoid()
        link_labels = get_link_labels(pos_edge_index, neg_edge_index)
        perfs.append(roc_auc_score(link_labels.cpu(), link_probs.cpu()))
    return perfs


def get_pred_edges(node_pairs, z, predTrue, sort_by_prob=False):
    logits = (z[node_pairs[0]] * z[node_pairs[1]]).sum(dim=-1)
    if sort_by_prob:
        sorted_logits, indices = torch.sort(logits, dim=0, descending=True)
        sorted_logits = sorted_logits[sorted_logits > 0]
        indices = indices[:sorted_logits.size(0)]
        selected_node_pairs = torch.index_select(node_pairs, 1, indices)
        print('sort by prob:')
        print(sorted_logits)
        print(selected_node_pairs.t())
        return selected_node_pairs.t().detach().tolist()
    else:
        pred_logits = logits > 0 if predTrue else logits < 0
        a = torch.stack((node_pairs[0][pred_logits], node_pairs[1][pred_logits]))
        return a.t().detach().tolist()



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='link-prediction')
    parser.add_argument("--source", required=True, choices=['imdb', 'yelp'],
            help="source of dataset")
    parser.add_argument("--dataset", type=str, required=True,
            help="path of dataset to use")
    parser.add_argument("--output-dir", type=str, required=True,
            help="path of output results")
    parser.add_argument("--n-epochs", type=int, default=100,
            help="number of training epochs")
    args = parser.parse_args()
    print('call arguments: ', args)

    path = osp.join(osp.dirname(osp.realpath(__file__)), 'data', args.source, args.dataset)
    dataset = MyImdbAndYelpDataset(path, transform=T.NormalizeFeatures())
    data = dataset[0]
    num_links = data.edge_index.shape[1]
    print('Number of links: ', num_links)
    print('before split:', data)
    data = train_test_split_edges(data)
    print('after split: ', data)
    
    print('==== START TRAINING ====')
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model, data = Net().to(device), data.to(device)
    optimizer = torch.optim.Adam(params=model.parameters(), lr=0.01)

    best_val_perf = test_perf = 0
    for epoch in range(1, args.n_epochs + 1):
        train_loss = train()
        val_perf, tmp_test_perf = test()
        if val_perf > best_val_perf:
            best_val_perf = val_perf
            test_perf = tmp_test_perf
        log = 'Epoch: {:03d}, Loss: {:.4f}, Val: {:.4f}, Test: {:.4f}'
        print(log.format(epoch, train_loss, best_val_perf, test_perf))


    z = model.encode()
    print(z.shape)
    print('embeddings: ', z)

    pred_unseen_edges = get_pred_edges(data.unseen_edges, z, True, sort_by_prob=True)
    unseen_edge_dict = {}
    for p in pred_unseen_edges:
        if p[0] not in unseen_edge_dict:
            unseen_edge_dict[p[0]] = []
        if p[1] not in unseen_edge_dict:
            unseen_edge_dict[p[1]] = []
        unseen_edge_dict[p[0]].append(p[1])
        unseen_edge_dict[p[1]].append(p[0])

    pred_true_allow = get_pred_edges(data.allow_node_pairs, z, True)
    pred_false_allow = get_pred_edges(data.allow_node_pairs, z, False)
    # print('Number of predicted unseen edges: ', pred_unseen_edges.shape)
    print(len(pred_true_allow), len(pred_false_allow))

    print('==== OUTPUT GRAPH AND EMBEDDINGS ====')
    output_dir = osp.join(args.output_dir, args.source, args.dataset)
    if not osp.exists(output_dir):
        makedirs(output_dir)

    pred_json = {
        # "trueUnseenEdges": pred_unseen_edges,
        "isLinkPrediction": True,
        "trueAllowEdges": pred_true_allow,
        "falseAllowEdges": pred_false_allow,
        "trueUnseenEdgesSorted": unseen_edge_dict,
    }
    json.dump(pred_json, open(osp.join(output_dir, 'prediction-results.json'), 'w'))
    # np.savetxt(osp.join(output_dir, 'debug.txt'), torch.triu(prob_adj, diagonal=1).detach().numpy(), fmt='%.7f') 

    output_emb = z.detach().numpy()
    np.savetxt(osp.join(output_dir, 'node-embeddings.csv'), output_emb, delimiter=',', fmt='%.3f')

    umap_emb = UMAP().fit_transform(output_emb)
    np.savetxt(osp.join(output_dir, 'umap.csv'), umap_emb, delimiter=',', fmt='%.3f')

    print('==== DONE ====')