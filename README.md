Glance Vessels
==============

[![Build Status](https://dev.azure.com/glance-vessels/glance-vessels/_apis/build/status/KitwareMedical.glance-vessels?branchName=master)](https://dev.azure.com/glance-vessels/glance-vessels/_build/latest?definitionId=1&branchName=master)

This is built off of ParaView Glance.

Installation
------------

Download the stand-alone executable:

| Operating System | Executable |
| ------------- |:-------------:|
| Linux | [glance-vessels.linux.x86_64](https://github.com/KitwareMedical/glance-vessels/releases/download/latest/glance-vessels.linux.x86_64) |
| macOS | [glance-vessels.macos.x86_64](https://github.com/KitwareMedical/glance-vessels/releases/download/latest/glance-vessels.macos.x86_64) |
| Windows | [glance-vessels.windows.x86_64.exe](https://github.com/KitwareMedical/glance-vessels/releases/download/latest/glance-vessels.windows.x86_64.exe) |

Usage
-----

Run the executable. A new tab will open in your web browser with the
application user interface.


Development
-----------

### Build

This has only been tested with python3.

```
$ git clone git@github.com:KitwareMedical/glance-vessels.git
$ cd glance-vessels/
$ npm install
$ npm run build:release
$ cd server/
$ pip install -r requirements.txt
```

To build a standalone executable:

```
$ pip install pyinstaller
```

On Windows, also install *pywin32*:

```
$ pip install pywin32
```

Then package as a directory:

```
$ pyinstaller build/glance-vessels.spec

```

Or as a single file:

```
$ pyinstaller build/glance-vessels-onefile.spec
```

### Run

Simply run the resultant executable from pyinstaller!

### Run web and server separately

For dev purposes, it is better to run the web and server as separate
instances for debugging.

One terminal:
```
$ cd glance-vessels/
$ npm run dev
```

Other terminal:
```
$ cd glance-vessels/server
$ python server.py
```

After the python server starts up, visit `http://localhost:9999/` to view the
webapp. If you get a blank screen, try clearing cache and then refreshing.


Troubleshooting
---------------

### Library issues when running (linux)

For the prebuilt binaries, this is likely due to the automated build
environment using a different version of certain libraries. The easiest
workaround is to follow the instructions under "Development" above and build
the application locally so pyinstaller can link against local libraries.

### The application is still running after closing the tab

Right now the server is set to self-terminate after 5 minutes. Either kill the
application manually or wait 5 minutes for the application to self-terminate.
Multiple instances of the application will not interfere with one another.
