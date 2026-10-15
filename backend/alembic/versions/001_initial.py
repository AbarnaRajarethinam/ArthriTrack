"""Initial isolated identity and structured record store."""
from alembic import op
import sqlalchemy as sa
revision='001'
down_revision=None
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('users',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('token_hash',sa.String(64),nullable=False,unique=True),sa.Column('profile',sa.JSON(),nullable=False))
    op.create_table('records',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('user_id',sa.Integer(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('kind',sa.String(30),nullable=False),sa.Column('mode',sa.String(8),nullable=False),sa.Column('data',sa.JSON(),nullable=False))
    for field in ['user_id','kind','mode']: op.create_index('ix_records_'+field,'records',[field])
    op.create_index('ix_records_scope','records',['user_id','mode','kind'])
def downgrade():
    op.drop_table('records');op.drop_table('users')
