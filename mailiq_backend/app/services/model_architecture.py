"""
Must match the notebook's BiGRUMultiTaskClassifier exactly -- the saved
state_dict's tensor shapes and layer names depend on this definition being
identical to what was trained.
"""
import torch
import torch.nn as nn


class BiGRUMultiTaskClassifier(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        embed_dim: int,
        hidden_dim: int,
        num_categories: int,
        num_priorities: int,
        num_layers: int = 1,
        dropout: float = 0.3,
        pad_idx: int = 0,
    ):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.gru = nn.GRU(
            input_size=embed_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.category_head = nn.Linear(hidden_dim * 2, num_categories)
        self.priority_head = nn.Linear(hidden_dim * 2, num_priorities)

    def forward(self, input_ids):
        embedded = self.embedding(input_ids)
        outputs, hidden = self.gru(embedded)
        forward_hidden = hidden[-2]
        backward_hidden = hidden[-1]
        combined = torch.cat([forward_hidden, backward_hidden], dim=1)
        combined = self.dropout(combined)
        category_logits = self.category_head(combined)
        priority_logits = self.priority_head(combined)
        return category_logits, priority_logits
