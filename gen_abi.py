#!/usr/bin/env python
import json
import os

PATH_TRUFFLE_WK = './build/contracts/'
PATH_EXPORT_ABI = './abi/'

if not os.path.exists(PATH_EXPORT_ABI):
    os.makedirs(PATH_EXPORT_ABI)

for root, dirs, files in os.walk(PATH_TRUFFLE_WK, topdown=False):
    for name in files:
        print(name)
        contract_file_path = os.path.join(root, name)
        abi_file_path = os.path.join(PATH_EXPORT_ABI, name.lower())
        with open(contract_file_path, "r") as file:
            truffle_file = json.loads(file.read())
            abi = truffle_file['abi']
        with open(abi_file_path, "w") as abi_file:
            abi_file.write(json.dumps(abi))

# bytecode = truffleFile['bytecode']
