paraview-glance-py
==============

[![Build Status](https://dev.azure.com/glance-vessels/paraview-glance-py/_apis/build/status/KitwareMedical.paraview-glance-py?branchName=master)](https://dev.azure.com/glance-vessels/paraview-glance-py/_build/latest?definitionId=2&branchName=master)

This is built off of ParaView Glance.

Installation
------------

Download the stand-alone executable:

| Operating System | Executable |
| ------------- |:-------------:|
| Linux | [paraview-glance-py.linux.x86_64](https://github.com/KitwareMedical/paraview-glance-py/releases/download/latest/paraview-glance-py.linux.x86_64) |
| macOS | [paraview-glance-py.macos.x86_64](https://github.com/KitwareMedical/paraview-glance-py/releases/download/latest/paraview-glance-py.macos.x86_64) |
| Windows | [paraview-glance-py.windows.x86_64.exe](https://github.com/KitwareMedical/paraview-glance-py/releases/download/latest/paraview-glance-py.windows.x86_64.exe) |

Usage
-----

Run the executable. A new tab will open in your web browser with the
application user interface.


Development
-----------

### Build

This has only been tested with python3.

```
$ git clone git@github.com:KitwareMedical/paraview-glance-py.git
$ cd paraview-glance-py/
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
$ pyinstaller build/paraview-glance-py.spec

```

Or as a single file:

```
$ pyinstaller build/paraview-glance-py-onefile.spec
```

### Run

Simply run the resultant executable
`dist/paraview-glance-py/paraview-glance-py`.

### Run web and server separately

For dev purposes, it is better to run the web and server as separate
instances for debugging.

In one terminal, build the development version of the webapp:
```
$ cd paraview-glance-py/
$ npm run dev
```

In another terminal, run the server.
```
$ cd paraview-glance-py/server
$ python server.py --port 8181 --no-browser
```

After the python server starts up, visit
`http://localhost:9999/?wsServer=ws://localhost:8181/ws` to view the webapp.
If you get a blank screen, try clearing cache and then refreshing.


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
