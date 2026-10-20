/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/marketcoins.json`.
 */
export type Marketcoins = {
  "address": "7dVSmyCyEK8dQrTiTqtyjLzTbhTwsL7ftRWyYTLkjUiM",
  "metadata": {
    "name": "marketcoins",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Marketcoins · cagnotte parimutuel sur Solana"
  },
  "instructions": [
    {
      "name": "cancel",
      "docs": [
        "Annule le marché : toutes les mises deviennent remboursables, frais compris.",
        "Possible tant que le marché est ouvert, ou pendant la fenêtre de contestation."
      ],
      "discriminator": [
        232,
        219,
        223,
        41,
        219,
        236,
        220,
        190
      ],
      "accounts": [
        {
          "name": "resolver",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "claim",
      "docs": [
        "Retire le gain d'une mise gagnante (marché final) ou son remboursement (marché annulé).",
        "Le compte de mise est fermé et son loyer rendu au parieur."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "bettor",
          "writable": true,
          "signer": true,
          "relations": [
            "bet"
          ]
        },
        {
          "name": "market",
          "relations": [
            "bet"
          ]
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "bettorTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args.marketId"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "docs": [
            "Cagnotte en USDC, détenue par le marché (PDA)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "createMarketArgs"
            }
          }
        }
      ]
    },
    {
      "name": "placeBet",
      "docs": [
        "Mise de `amount` (en unités du mint, 6 décimales pour l'USDC) sur `outcome`.",
        "Plusieurs mises d'un même wallet sur un même résultat s'additionnent."
      ],
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "bettor",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "bet",
          "writable": true
        },
        {
          "name": "bettorTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "outcome",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolve",
      "docs": [
        "Annonce (ou corrige, pendant la fenêtre de contestation) le résultat gagnant.",
        "Si personne n'a misé sur le gagnant, le marché est annulé et tout le monde est remboursé."
      ],
      "discriminator": [
        246,
        150,
        236,
        206,
        108,
        63,
        58,
        10
      ],
      "accounts": [
        {
          "name": "resolver",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdrawFees",
      "docs": [
        "L'autorité retire les frais, une fois le marché résolu et la contestation close."
      ],
      "discriminator": [
        198,
        212,
        171,
        109,
        144,
        215,
        174,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "authorityTokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "bet",
      "discriminator": [
        147,
        23,
        35,
        59,
        15,
        75,
        155,
        32
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    }
  ],
  "events": [
    {
      "name": "betPlaced",
      "discriminator": [
        88,
        88,
        145,
        226,
        126,
        206,
        32,
        0
      ]
    },
    {
      "name": "claimed",
      "discriminator": [
        217,
        192,
        123,
        72,
        108,
        150,
        248,
        33
      ]
    },
    {
      "name": "feesWithdrawn",
      "discriminator": [
        234,
        15,
        0,
        119,
        148,
        241,
        40,
        21
      ]
    },
    {
      "name": "marketCancelled",
      "discriminator": [
        139,
        163,
        33,
        168,
        19,
        180,
        81,
        170
      ]
    },
    {
      "name": "marketCreated",
      "discriminator": [
        88,
        184,
        130,
        231,
        226,
        84,
        6,
        58
      ]
    },
    {
      "name": "marketResolved",
      "discriminator": [
        89,
        67,
        230,
        95,
        143,
        106,
        199,
        202
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidOutcomeCount",
      "msg": "Entre 2 et 16 résultats"
    },
    {
      "code": 6001,
      "name": "feeTooHigh",
      "msg": "Frais supérieurs au maximum autorisé"
    },
    {
      "code": 6002,
      "name": "closesInPast",
      "msg": "La fermeture des mises est déjà passée"
    },
    {
      "code": 6003,
      "name": "closesAfterEnd",
      "msg": "Les mises doivent fermer avant la fin du défi"
    },
    {
      "code": 6004,
      "name": "invalidDisputeWindow",
      "msg": "Fenêtre de contestation invalide"
    },
    {
      "code": 6005,
      "name": "marketNotOpen",
      "msg": "Le marché n'est pas ouvert"
    },
    {
      "code": 6006,
      "name": "betsClosed",
      "msg": "Les mises sont fermées"
    },
    {
      "code": 6007,
      "name": "invalidOutcome",
      "msg": "Résultat inconnu"
    },
    {
      "code": 6008,
      "name": "zeroAmount",
      "msg": "Montant nul"
    },
    {
      "code": 6009,
      "name": "challengeNotOver",
      "msg": "Le défi n'est pas terminé"
    },
    {
      "code": 6010,
      "name": "marketFinal",
      "msg": "Le marché est déjà définitif"
    },
    {
      "code": 6011,
      "name": "marketCancelled",
      "msg": "Le marché est annulé"
    },
    {
      "code": 6012,
      "name": "marketNotResolved",
      "msg": "Le marché n'est pas résolu"
    },
    {
      "code": 6013,
      "name": "marketNotFinal",
      "msg": "Le marché n'est pas encore définitif"
    },
    {
      "code": 6014,
      "name": "disputeWindowOpen",
      "msg": "Fenêtre de contestation en cours"
    },
    {
      "code": 6015,
      "name": "losingBet",
      "msg": "Mise perdante"
    },
    {
      "code": 6016,
      "name": "nothingToWithdraw",
      "msg": "Rien à retirer"
    },
    {
      "code": 6017,
      "name": "unauthorized",
      "msg": "Non autorisé"
    },
    {
      "code": 6018,
      "name": "overflow",
      "msg": "Dépassement arithmétique"
    }
  ],
  "types": [
    {
      "name": "bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "amount",
            "docs": [
              "Montant brut débité."
            ],
            "type": "u64"
          },
          {
            "name": "stake",
            "docs": [
              "Mise nette, entrée dans la cagnotte."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "betPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "outcomePool",
            "type": "u64"
          },
          {
            "name": "totalPool",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "cancelReason",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "byResolver"
          },
          {
            "name": "noWinningBets"
          }
        ]
      }
    },
    {
      "name": "claimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createMarketArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "docs": [
              "Identifiant du défi (le `challenge_no` côté site), unique par programme."
            ],
            "type": "u64"
          },
          {
            "name": "nOutcomes",
            "type": "u8"
          },
          {
            "name": "feeBps",
            "docs": [
              "Frais en points de base : 200 = 2 %."
            ],
            "type": "u16"
          },
          {
            "name": "closesAt",
            "docs": [
              "Fermeture des mises (timestamp Unix)."
            ],
            "type": "i64"
          },
          {
            "name": "endsAt",
            "docs": [
              "Fin du défi : la résolution est possible à partir de là."
            ],
            "type": "i64"
          },
          {
            "name": "disputeSeconds",
            "docs": [
              "Fenêtre de contestation après la résolution (24 h = 86 400)."
            ],
            "type": "i64"
          },
          {
            "name": "resolver",
            "docs": [
              "Clé autorisée à résoudre ou annuler (multisig)."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "feesWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "nOutcomes",
            "type": "u8"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "closesAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "disputeSeconds",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "marketStatus"
              }
            }
          },
          {
            "name": "winner",
            "docs": [
              "Index du gagnant, `u8::MAX` tant qu'il n'y en a pas."
            ],
            "type": "u8"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "pools",
            "docs": [
              "Cagnotte par résultat (mises nettes de frais)."
            ],
            "type": {
              "array": [
                "u64",
                16
              ]
            }
          },
          {
            "name": "totalPool",
            "docs": [
              "Σ pools."
            ],
            "type": "u64"
          },
          {
            "name": "totalVolume",
            "docs": [
              "Σ montants bruts misés."
            ],
            "type": "u64"
          },
          {
            "name": "feesAccrued",
            "docs": [
              "Frais encaissés, encore dans le vault."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": {
              "defined": {
                "name": "cancelReason"
              }
            }
          }
        ]
      }
    },
    {
      "name": "marketCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "nOutcomes",
            "type": "u8"
          },
          {
            "name": "closesAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "u8"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "finalAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "resolved"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    }
  ]
};
