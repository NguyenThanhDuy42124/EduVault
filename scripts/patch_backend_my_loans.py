path = 'backend/app/api/v1/loans.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

endpoint_code = '''
@router.get(
    "/my-loans",
    response_model=List[LoanResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách đơn mượn của chính tôi (Alias)"
)
def my_loans_alias_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[LoanResponse]:
    loans = get_loans(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return [_to_loan_response(l) for l in loans]
'''

insert_target = '@router.get(\n    "/{loan_id}",'
if insert_target in text:
    text = text.replace(insert_target, endpoint_code + '\n' + insert_target)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('SUCCESS_ADDED_MY_LOANS_ENDPOINT')
else:
    print('TARGET_NOT_FOUND')

