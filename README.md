# Netgear NSDP

This module gives access to Netgear switches (e.g. GS108E) via the *highly secured* switch discovery protocol created by Netgear. Acutally *highly secured* means: sending passwords encrypted by just XORing with the string "NtgrSmartSwitchRock" over the network using broadcast packages. So every chosen password used for securing these switches can be considered to be compromised.


