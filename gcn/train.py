import argparse, time
import numpy as np
import networkx as nx
import torch
import torch.nn as nn
import torch.nn.functional as F
from dgl import DGLGraph
from dgl.data import register_data_args, load_data

from gcn import GCN
#from gcn_mp import GCN
#from gcn_spmv import GCN
import json
from umap import UMAP


def evaluate(model, features, labels, mask):
    model.eval()
    with torch.no_grad():
        logits, emb = model(features)
        logits = logits[mask]
        labels = labels[mask]
        _, indices = torch.max(logits, dim=1)
        correct = torch.sum(indices == labels)
        return correct.item() * 1.0 / len(labels), emb

def predict(model, features):
    model.eval()
    with torch.no_grad():
        logits, emb = model(features)
        _, indices = torch.max(logits, dim=1)
        return indices

def main(args):
    # load and preprocess dataset
    data = load_data(args)
    features = torch.FloatTensor(data.features)
    labels = torch.LongTensor(data.labels)
    if hasattr(torch, 'BoolTensor'):
        train_mask = torch.BoolTensor(data.train_mask)
        val_mask = torch.BoolTensor(data.val_mask)
        test_mask = torch.BoolTensor(data.test_mask)
    else:
        train_mask = torch.ByteTensor(data.train_mask)
        val_mask = torch.ByteTensor(data.val_mask)
        test_mask = torch.ByteTensor(data.test_mask)
    in_feats = features.shape[1]
    n_classes = data.num_labels
    n_edges = data.graph.number_of_edges()
    print("""----Data statistics------'
      #Edges %d
      #Classes %d
      #Train samples %d
      #Val samples %d
      #Test samples %d""" %
          (n_edges, n_classes,
              train_mask.int().sum().item(),
              val_mask.int().sum().item(),
              test_mask.int().sum().item()))

    if args.gpu < 0:
        cuda = False
    else:
        cuda = True
        torch.cuda.set_device(args.gpu)
        features = features.cuda()
        labels = labels.cuda()
        train_mask = train_mask.cuda()
        val_mask = val_mask.cuda()
        test_mask = test_mask.cuda()

    # graph preprocess and calculate normalization factor
    g = data.graph
    # add self loop
    if args.self_loop:
        g.remove_edges_from(nx.selfloop_edges(g))
        g.add_edges_from(zip(g.nodes(), g.nodes()))
    g = DGLGraph(g)
    n_edges = g.number_of_edges()
    # normalization
    degs = g.in_degrees().float()
    norm = torch.pow(degs, -0.5)
    norm[torch.isinf(norm)] = 0
    if cuda:
        norm = norm.cuda()
    g.ndata['norm'] = norm.unsqueeze(1)

    # create GCN model
    model = GCN(g,
                in_feats,
                args.n_hidden,
                n_classes,
                args.n_layers,
                F.relu,
                args.dropout)

    if cuda:
        model.cuda()
    loss_fcn = torch.nn.CrossEntropyLoss()

    # use optimizer
    optimizer = torch.optim.Adam(model.parameters(),
                                 lr=args.lr,
                                 weight_decay=args.weight_decay)

    # initialize graph
    dur = []
    for epoch in range(args.n_epochs):
        model.train()
        if epoch >= 3:
            t0 = time.time()
        # forward
        logits, _ = model(features)
        loss = loss_fcn(logits[train_mask], labels[train_mask])

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if epoch >= 3:
            dur.append(time.time() - t0)

        acc, _ = evaluate(model, features, labels, val_mask)
        print("Epoch {:05d} | Time(s) {:.4f} | Loss {:.4f} | Accuracy {:.4f} | "
              "ETputs(KTEPS) {:.2f}". format(epoch, np.mean(dur), loss.item(),
                                             acc, n_edges / np.mean(dur) / 1000))

    print()
    acc, emb = evaluate(model, features, labels, test_mask)
    print("Test accuracy {:.2%}".format(acc))
    print()
    print('# Dimensions of embeddings: ', len(emb[0]))

    output_dir = '../data/' + args.dataset + '-gcn/'
    np.savetxt(output_dir + 'node-embeddings.csv', emb.numpy(), delimiter=',', fmt='%.3f')    
    nx_graph = g.to_networkx()
    # for node in nx_graph.nodes():
    #     node['features'] = features[node.id]
    json_data = nx.node_link_data(nx_graph)
    json.dump(json_data, open(output_dir + 'graph.json', 'w'), allow_nan=False)
    
    umap_emb = UMAP().fit_transform(emb)
    np.savetxt(output_dir + 'umap.csv', umap_emb, delimiter=',', fmt='%.3f')

    if args.dataset == 'cora' or args.dataset == 'citeseer':
        def convert_to_binary(x):
            return 1 if x > 0 else 0
        bin_features = np.vectorize(convert_to_binary)(features.numpy())
        np.savetxt(output_dir + 'features.csv', bin_features, delimiter=',', fmt='%d')
    else:
        np.savetxt(output_dir + 'features.csv', features.numpy(), delimiter=',', fmt='%.3f')

    np.savetxt(output_dir + 'true-labels.txt', labels.numpy(), delimiter=',', fmt='%d')
    pred_labels = predict(model, features)
    np.savetxt(output_dir + 'pred-labels.txt', pred_labels.numpy(), delimiter=',', fmt='%d')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='GCN')
    register_data_args(parser)
    parser.add_argument("--dropout", type=float, default=0.5,
            help="dropout probability")
    parser.add_argument("--gpu", type=int, default=-1,
            help="gpu")
    parser.add_argument("--lr", type=float, default=1e-2,
            help="learning rate")
    parser.add_argument("--n-epochs", type=int, default=200,
            help="number of training epochs")
    parser.add_argument("--n-hidden", type=int, default=16,
            help="number of hidden gcn units")
    parser.add_argument("--n-layers", type=int, default=1,
            help="number of hidden gcn layers")
    parser.add_argument("--weight-decay", type=float, default=5e-4,
            help="Weight for L2 loss")
    parser.add_argument("--self-loop", action='store_true',
            help="graph self-loop (default=False)")
    parser.set_defaults(self_loop=False)
    args = parser.parse_args()
    print(args)

    main(args)
