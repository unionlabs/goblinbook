# OrbStack

OrbStack is a fast, light-weight alternative to Docker Desktop and traditional VMs for macOS. It provides a seamless way to run containers and Linux machines on your Mac with significantly better performance and resource efficiency than traditional solutions.

OrbStack integrates containerization and virtualization capabilities directly into macOS, allowing you to:

- Run Docker containers with native-like performance
- Create and manage lightweight Linux VMs
- Access containers and VMs via terminal, SSH, or VS Code
- Seamlessly share files between host and guest systems
- Use familiar Docker CLI commands without modification

Normally, these functions are not available on Apple, or do not make use of the latest Apple features, which causes performance degradation. For singular docker containers, you do not really notice this, but when for example building a relayer, you will run multiple devnets on one machine, as well as a prover. Performance is key to mimic production environments.
