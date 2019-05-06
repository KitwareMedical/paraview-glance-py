import uuid

import wslink
from wslink.websocket import LinkProtocol

from adapters import transform

class Api(LinkProtocol):
    def __init__(self):
        super().__init__()
        self._cache = {}

    def rewrite_args(self, args, kwargs):
        new_args = []
        new_kwargs = {}

        for arg in args:
            if type(arg) is dict and '__uid__' in arg:
                uid = arg['__uid__']
                new_args.append(self._cache.get(uid, None))
            else:
                new_args.append(arg)

        for key in kwargs:
            kwarg = kwargs[key]
            if type(kwarg) is dict and '__uid__' in kwarg:
                uid = kwarg['__uid__']
                new_kwargs[key] = self._cache.get(uid, None)
            else:
                new_kwargs[key] = kwarg

        return new_args, new_kwargs

    @wslink.register('persist_object')
    def persist_object(self, obj):
        uid = str(uuid.uuid4())
        self._cache[uid] = obj
        return uid

    @wslink.register('delete_persistent')
    def delete_persistent(self, uid):
        if uid in self._cache:
            del self._cache[uid]

def rpc(name):
    def wrapper(fn):
        def handler(self, *args, **kwargs):
            args, kwargs = self.rewrite_args(args, kwargs)
            args = [transform(arg) for arg in args]
            kwargs = {key:transform(kwargs[key]) for key in kwargs}

            retval = fn(self, *args, **kwargs)
            return transform(retval, self.addAttachment)

        return wslink.register(name)(handler)

    return wrapper
