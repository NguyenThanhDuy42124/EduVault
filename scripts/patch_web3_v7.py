path = 'backend/app/services/blockchain_service.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = 'tx_hash_bytes = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)'
replacement = '''raw_tx = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
        tx_hash_bytes = self.web3.eth.send_raw_transaction(raw_tx)'''

text = text.replace(target, replacement)

# Sửa blockNumber và gasUsed nếu cần
text = text.replace('"block_number": receipt.blockNumber', '"block_number": getattr(receipt, "block_number", getattr(receipt, "blockNumber", None))')
text = text.replace('"gas_used": receipt.gasUsed', '"gas_used": getattr(receipt, "gas_used", getattr(receipt, "gasUsed", None))')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('PATCHED_BLOCKCHAIN_SERVICE')

