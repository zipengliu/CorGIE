import os.path as osp
from os import makedirs
import argparse
import json
import numpy as np
from umap import UMAP

import torch
import torch.nn.functional as F
from torch_geometric.datasets import Planetoid
import torch_geometric.transforms as T
from torch_geometric.nn import GATConv


class Net(torch.nn.Module):
    def __init__(self):
        super(Net, self).__init__()

        self.conv1 = GATConv(dataset.num_features, 8, heads=8, dropout=0.6)
        # On the Pubmed dataset, use heads=8 in conv2.
        self.conv2 = GATConv(8 * 8, dataset.num_classes, heads=1, concat=False,
                             dropout=0.6)

    def forward(self, x, edge_index):
        x = F.dropout(x, p=0.6, training=self.training)
        x = F.elu(self.conv1(x, edge_index))
        x = F.dropout(x, p=0.6, training=self.training)
        x = self.conv2(x, data.edge_index)
        return F.log_softmax(x, dim=-1)
        
    def get_node_embeddings(self, x, edge_index):
        x = F.dropout(x, p=0.6, training=self.training)
        x = F.elu(self.conv1(x, edge_index))
        x = F.dropout(x, p=0.6, training=self.training)
        x = self.conv2(x, data.edge_index)
        return x


def train(data):
    model.train()
    optimizer.zero_grad()
    out = model(data.x, data.edge_index)
    loss = F.nll_loss(out[data.train_mask], data.y[data.train_mask])
    loss.backward()
    optimizer.step()


def test(data):
    model.eval()
    out, accs = model(data.x, data.edge_index), []
    for _, mask in data('train_mask', 'val_mask', 'test_mask'):
        pred = out[mask].max(1)[1]
        acc = pred.eq(data.y[mask]).sum().item() / mask.sum().item()
        accs.append(acc)
    return accs


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='GAT for cora / citeseer / pubmed')
    parser.add_argument("--dataset", type=str, required=True,
            help="path of dataset to use")
    parser.add_argument("--output-dir", type=str, required=True,
            help="path of output results")
    parser.add_argument("--n-epochs", type=int, default=200,
            help="number of training epochs")
    args = parser.parse_args()
    print('call arguments: ', args)

    path = osp.join(osp.dirname(osp.realpath(__file__)), 'data', args.dataset)
    dataset = Planetoid(path, args.dataset, transform=T.NormalizeFeatures())
    data = dataset[0]
    print(data)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model, data = Net().to(device), data.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4)

    print('==== START TRAINING ====')
    for epoch in range(1, args.n_epochs + 1):
        train(data)
        train_acc, val_acc, test_acc = test(data)
        print(f'Epoch: {epoch:03d}, Train: {train_acc:.4f}, Val: {val_acc:.4f}, '
            f'Test: {test_acc:.4f}')


    print('==== OUTPUT GRAPH AND EMBEDDINGS ====')
    model.eval()
    z = model.get_node_embeddings(data.x, data.edge_index)
    out = model(data.x, data.edge_index)
    pred = out.max(1)[1]

    if not osp.exists(args.output_dir):
        makedirs(args.output_dir)

    pred_res_json = {
        'predLabels': pred.tolist(),
        'trueLabels': data.y.tolist(),
        'numNodeClasses': np.unique(data.y.numpy()).shape[0]
    }
    json.dump(pred_res_json, open(osp.join(args.output_dir, 'prediction-results.json'), 'w'))

    output_emb = z.detach().numpy()
    np.savetxt(osp.join(args.output_dir, 'node-embeddings.csv'), output_emb, delimiter=',', fmt='%.3f')

    umap_emb = UMAP().fit_transform(output_emb)
    np.savetxt(osp.join(args.output_dir, 'umap.csv'), umap_emb, delimiter=',', fmt='%.3f')

    output_links = [{'source': data.edge_index[0][i].item(), 'target': data.edge_index[1][i].item()} 
        for i in range(data.edge_index.size(1))]
    graphjson = {
        "nodes": [{"id": i} for i in range(data.num_nodes)], 
        'links': output_links
        }
    json.dump(graphjson, open(osp.join(args.output_dir, 'graph.json'), 'w'))

    feature_path = osp.join(args.output_dir, 'features.csv')
    if args.dataset == 'Cora' or args.dataset == 'Citeseer':
        def convert_to_binary(x):
            return 1 if x > 0 else 0
        bin_features = np.vectorize(convert_to_binary)(data.x.numpy())
        np.savetxt(feature_path, bin_features, delimiter=',', fmt='%d')
    else:
        np.savetxt(feature_path, data.x.numpy(), delimiter=',', fmt='%.2g')

    print('==== DONE ====')