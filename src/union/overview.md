# Overview

Before we explore how IBC and Union work, we take a short detour to get acquainted with interoperability in general.

At its core, interoperability is about relaying data between two smart contracts on different chains, the same way that the internet is used to relay data between two processes on different servers. In our analogy here, a smart contract functions as a standalone process. Building from this abstraction, we realise that a connection really acts as a way for smart contracts to send bytes to each other.

Often in various protocols, we talk about message sending between chains. These messages are effectively data packets. Just as TCP/IP provides guarantees about packet delivery and ordering across the internet, blockchain interoperability protocols must provide similar guarantees about message delivery and execution across chains. The key difference is that while internet protocols primarily ensure data integrity and delivery, blockchain interoperability protocols must also ensure consensus agreement and cryptographic verification of the messages being relayed.

This means that cross-chain communication requires not just moving data, but also proving that the data came from a valid source and was properly authorized. The relayers that facilitate this communication serve a role similar to routers in internet infrastructure, but with the additional responsibility of providing cryptographic proofs and handling consensus verification.

We will go through each layer of Union's protocol and explain how packet semantics, cryptographic verification and guaranteed delivery is implemented.
