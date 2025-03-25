def _aggregate_pubkeys(committee, bits):
    pubkeys = []
    for i, bit in enumerate(bits):
        if bit:
            pubkeys.append(committee[i])
    return bls.Aggregate(pubkeys)