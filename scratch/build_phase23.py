# -*- coding: utf-8 -*-
import os, sys

FRONTEND_DIR = os.path.abspath('frontend')
for sub in ['types', 'api', 'hooks', 'components/screening', 'pages/patient']:
    os.makedirs(os.path.join(FRONTEND_DIR, 'src', sub.replace('/', os.sep)), exist_ok=True)

print('Directories ready')
