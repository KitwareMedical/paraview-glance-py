# -*- mode: python -*-

import os
import sys

entry_point = os.path.join('server', 'server.py')

# Must run from the top of the repository
repo_dir = os.getcwd()
if not os.path.exists(entry_point):
    print('Please run pyinstaller from the top level of the repository',)
    sys.exit(1)


block_cipher = None


a = Analysis([os.path.join('..', entry_point)],
             pathex=[repo_dir],
             binaries=[],
             datas=[(os.path.join('..', 'dist'), 'www')],
             hiddenimports=[],
             hookspath=['./build/'],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             noarchive=False)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          [],
          exclude_binaries=True,
          name='paraview-glance-py',
          debug=False,
          bootloader_ignore_signals=False,
          strip=False,
          upx=True,
          console=True )
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=True,
               name='paraview-glance-py')
