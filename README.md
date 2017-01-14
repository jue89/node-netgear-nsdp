# Netgear NSDP

This module gives access to Netgear switches (e.g. GS108E) via the *highly secured* switch discovery protocol created by Netgear. Actually *highly secured* means: sending passwords encrypted by just XORing with the string "NtgrSmartSwitchRock" over the network using broadcast packages. So every chosen password used for securing these switches can be considered to be compromised.

Furthermore most (or even every?) write operation can be performed without stating any password! The switch will complain about the missing password but will execute the desired write operation anyway. I actually have absolutely no idea what Netgear is doing there. So if you still want to use these switches (what can be completely okay if you are the only user on the network or trust all other users) you may should consider using VLAN 1 exclusively for switch management and another VLAN for you LAN.
