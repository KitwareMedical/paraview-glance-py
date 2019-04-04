Glance Vessels
==============

This is built off of ParaView Glance.

Building
========

This has only been tested with python3.

```
$ git clone git@github.com:KitwareMedical/glance-vessels.git
$ cd glance-vessels/
$ git submodule init
$ git submodule update
$ npm install
$ npm run build:release
$ cd server/
$ pip install -r requirements.txt
```

Running
=======

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
