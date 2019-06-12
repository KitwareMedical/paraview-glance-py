import weakref
import uuid

import numpy
import wslink
from wslink.websocket import LinkProtocol

from serializable import serialize, unserialize
import transformers # register our serializers/unserializers

def rpc(name):
    def wrapper(fn):
        def handler(self, *args, **kwargs):
            args, kwargs = self.rewrite_args(args, kwargs)

            retval = fn(self, *args, **kwargs)
            uid = self.get_persistent_uid(retval)


            def attachment_replacer(key, value):
                if type(value) is numpy.ndarray:
                    return {
                        '$type': 'ArrayBuffer',
                        'dataType': str(value.dtype),
                        'buffer': self.addAttachment(value.tobytes()),
                    }
                return value

            return {
                'uid': uid,
                'data': serialize(retval, attachment_replacer)
            }

        return wslink.register(name)(handler)

    return wrapper

class Api(LinkProtocol):
    def __init__(self):
        super().__init__()
        self._cache = {}
        self._persistent_objects = weakref.WeakKeyDictionary()

    def rewrite_args(self, args, kwargs):
        new_args = []
        new_kwargs = {}

        for arg in args:
            if type(arg) is dict:
                uid = arg['uid']
                data = arg['data']
                if uid is None:
                    new_args.append(unserialize(data))
                else:
                    new_args.append(self._cache.get(uid, None))
            else:
                raise Exception('Unknown argument format')

        for key in kwargs:
            kwarg = kwargs[key]
            if type(kwarg) is dict:
                uid = kwarg['uid']
                data = kwarg['data']
                if uid is None:
                    new_kwargs[key] = unserialize(data)
                else:
                    new_kwargs[key] = self._cache.get(uid, None)
            else:
                raise Exception('Unknown argument format')

        return new_args, new_kwargs

    def persist(self, obj):
        uid = str(uuid.uuid4())
        self._cache[uid] = obj
        self._persistent_objects[obj] = uid

    def delete(self, obj):
        if obj in self._persistent_objects:
            uid = self._persistent_objects[obj]
            del self._persistent_objects[obj]
            del self._cache[uid]

    def get_persistent_uid(self, obj):
        try:
            return self._persistent_objects.get(obj, None)
        except:
            return None

    @rpc('persist_object')
    def persist_object(self, obj):
        '''RPC use only'''
        uid = str(uuid.uuid4())
        self._cache[uid] = obj
        return uid

    @rpc('delete_object')
    def delete_object(self, uid):
        '''RPC use only'''
        if uid in self._cache:
            del self._cache[uid]
