import copy

serializers = []
unserializers = []

def clone(o):
    try:
        return copy.copy(o)
    except:
        return o

class JSONRecurser(object):
    def __init__(self):
        self.transformers = []

    def register_transformer(self, fn, tester):
        self.transformers.append((fn, tester))

    def replace(self, key, value):
        for transformer, tester in self.transformers:
            flag = False

            try:
                flag = tester(key, value)
            except Exception as e:
                # TODO debug log exception
                pass

            if flag:
                return transformer(key, value)

        return value

    def recurse(self, obj, extra_transformer=lambda k, v: v):
        def replacer(key, value):
            new_value = self.replace(key, value)
            return extra_transformer(key, new_value)

        return self._recurse(replacer(None, obj), replacer)

    def _recurse(self, obj, replacer):
        obj = clone(obj)
        if type(obj) is dict:
            for key in obj:
                value = obj[key]
                obj[key] = self._recurse(replacer(key, value), replacer)
        elif type(obj) is list or type(obj) is tuple:
            listObj = []
            for i, v in enumerate(obj):
                listObj.append(self._recurse(replacer(i, v), replacer))
            obj = type(obj)(listObj)
        return obj

_serializeRecurser = JSONRecurser()
_unserializeRecurser = JSONRecurser()

# decorator
def serializer(tester):
    def wrapper(fn):
        _serializeRecurser.register_transformer(fn, tester)
        return fn
    return wrapper

# decorator
def unserializer(tester):
    def wrapper(fn):
        _unserializeRecurser.register_transformer(fn, tester)
        return fn
    return wrapper

serialize = _serializeRecurser.recurse
unserialize = _unserializeRecurser.recurse
