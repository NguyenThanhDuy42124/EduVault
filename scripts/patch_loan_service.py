path = 'frontend/src/services/loanService.ts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("api.get<Loan[]>('/loans/my-loans')", "api.get<Loan[]>('/loans')")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print('UPDATED_LOAN_SERVICE')

