# Apple

Most developers building on Union use macbooks as their main development machine, in combination with lightweight \*nix VMs.

When locally developing on macbooks, there's a few things to keep in mind:

- Docker does not have first class support. We recommend [orbstack](https://orbstack.dev/) and our [guide](./orbstack.md).
- Some applications need to be cross-compiled. For all Union-related services, we provide cross-compiled binaries. However other projects may not be as widely support.
