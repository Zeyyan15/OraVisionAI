"""chat_attachments_and_report_share

Revision ID: 002_chat_attachments_and_report_share
Revises: 001_initial_database_schema
Create Date: 2026-09-27 21:00:00.000000

Phase 34: Introduces normalized message attachments table, adds report_id foreign key
reference to messages for clinical report sharing, and updates chk_message_type constraint.
Preserves existing attachment_storage_path column and all historical message data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_chat_attach_report_share'
down_revision: Union[str, None] = '001_initial_database_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update chk_message_type check constraint on messages table
    op.drop_constraint('chk_message_type', 'messages', type_='check')
    op.create_check_constraint(
        'chk_message_type',
        'messages',
        "message_type IN ('text', 'image', 'attachment', 'screening_share', 'report_share', 'system')",
    )

    # 2. Add report_id foreign key column to messages table
    op.add_column('messages', sa.Column('report_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_messages_report_id',
        'messages',
        'reports',
        ['report_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('idx_messages_report_id', 'messages', ['report_id'], unique=False)

    # 3. Create normalized message_attachments table
    op.create_table(
        'message_attachments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('message_id', sa.UUID(), nullable=False),
        sa.Column('storage_path', sa.Text(), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('attachment_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("attachment_type IN ('image', 'document')", name='chk_attachment_type'),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_message_attachments_message_id', 'message_attachments', ['message_id'], unique=False)


def downgrade() -> None:
    # 1. Drop message_attachments table and its index
    op.drop_index('idx_message_attachments_message_id', table_name='message_attachments')
    op.drop_table('message_attachments')

    # 2. Drop report_id from messages
    op.drop_index('idx_messages_report_id', table_name='messages')
    op.drop_constraint('fk_messages_report_id', 'messages', type_='foreignkey')
    op.drop_column('messages', 'report_id')

    # 3. Revert chk_message_type to original values
    op.drop_constraint('chk_message_type', 'messages', type_='check')
    op.create_check_constraint(
        'chk_message_type',
        'messages',
        "message_type IN ('text', 'image', 'screening_share', 'system')",
    )
