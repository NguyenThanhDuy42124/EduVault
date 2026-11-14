"""add wallet verification fields to users

Revision ID: c2d9e4f7a102
Revises: 8bd1d029877b
Create Date: 2026-11-14 17:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d9e4f7a102'
down_revision: Union[str, Sequence[str], None] = '8bd1d029877b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with verified wallet binding and challenge nonce columns."""
    op.add_column(
        'users',
        sa.Column('wallet_verified', sa.Boolean(), nullable=False, server_default=sa.text('0'))
    )
    op.add_column('users', sa.Column('wallet_nonce', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('wallet_nonce_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('wallet_challenge_address', sa.String(length=42), nullable=True))
    op.add_column('users', sa.Column('wallet_linked_at', sa.DateTime(), nullable=True))
    op.create_index('ix_users_wallet_address', 'users', ['wallet_address'], unique=True)


def downgrade() -> None:
    """Downgrade schema by removing wallet verification columns and index."""
    op.drop_index('ix_users_wallet_address', table_name='users')
    op.drop_column('users', 'wallet_linked_at')
    op.drop_column('users', 'wallet_challenge_address')
    op.drop_column('users', 'wallet_nonce_expires_at')
    op.drop_column('users', 'wallet_nonce')
    op.drop_column('users', 'wallet_verified')
