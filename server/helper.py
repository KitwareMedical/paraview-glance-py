import sys
import struct
import random

import numpy as np
import itk
from wslink import register as rpc
from wslink.websocket import LinkProtocol

def print_matrix(itkmat, size=(3, 3)):
    for i in range(size[0]):
        for j in range(size[1]):
            sys.stdout.write('{} '.format(itkmat(i, j)))
        sys.stdout.write('\n')


# modified from: https://github.com/InsightSoftwareConsortium/itk-jupyter-widgets/blob/master/itkwidgets/trait_types.py#L49
def _itk_image_to_type(itkimage):
    component_str = repr(itkimage).split('itkImagePython.')[1].split(';')[0][8:]
    if component_str[:2] == 'UL':
        if os.name == 'nt':
            return 'uint32_t',
        else:
            return 'uint64_t',
    mangle = None
    if component_str[:2] == 'SL':
        if os.name == 'nt':
            return 'int32_t', 1,
        else:
            return 'int64_t', 1,
    if component_str[0] == 'V':
        # Vector
        mangle = component_str[1]
    elif component_str[:2] == 'CF':
        # complex flot
        return 'float', 10
    elif component_str[:2] == 'CD':
        # complex flot
        return 'double', 10
    elif component_str[0] == 'C':
        # CovariantVector
        mangle = component_str[1]
    elif component_str[0] == 'O':
        # Offset
        return 'int64_t', 4
    elif component_str[:2] == 'FA':
        # FixedArray
        mangle = component_str[2]
    elif component_str[:4] == 'RGBA':
        # RGBA
        mangle = component_str[4:-1]
    elif component_str[:3] == 'RGB':
        # RGB
        mangle = component_str[3:-1]
    elif component_str[:4] == 'SSRT':
        # SymmetricSecondRankTensor
        mangle = component_str[4:-1]
    else:
        mangle = component_str[:-1]
    _python_to_js = {
        'SC':'Int8Arrray',
        'UC':'Uint8Array',
        'SS':'Int16Array',
        'US':'Uint16Array',
        'SI':'Int32Array',
        'UI':'Uint32Array',
        'F':'Float32Array',
        'D':'Float64Array',
        'B':'Uint8Array'
        }
    print('type:', mangle)
    return _python_to_js[mangle]

def itk_to_vtkjs_image(itk_image, name='Default Name'):
    dims = list(itk_image.GetLargestPossibleRegion().GetSize())
    extent = []
    for v in dims:
        extent.append(0)
        extent.append(v - 1)

    values = itk.GetArrayFromImage(itk_image).flatten(order='C').tolist()

    return {
        'vtkClass': 'vtkImageData',
        'name': name,
        'dataDescription': 8, # StructuredData.XYZ_GRID from vtk.js
        'spacing': list(itk_image.GetSpacing()),
        'origin': list(itk_image.GetOrigin()),
        'direction': list(itk.GetArrayFromVnlMatrix(itk_image.GetDirection().GetVnlMatrix().as_matrix()).flatten()),
        'extent': extent,
        'pointData': {
            'vtkClass': 'vtkDataSetAttributes',
            'activeScalars': 0,
            'arrays': [{
                'data': {
                    'vtkClass': 'vtkDataArray',
                    'dataType': _itk_image_to_type(itk_image),
                    'name': 'Scalars',
                    'numberOfComponents': itk_image.GetNumberOfComponentsPerPixel(),
                    'rangeTuple': [0, 255], # range of data
                    'size': len(values),
                    'values': values,
                },
            }],
        },
    }

def _vtkjs_type_convert(blob, jstype):
    js_to_py_type = {
        'Int8Array': {
            'struct': (1, 'b'),
            'dtype': 'int8',
        },
        'Int16Array': {
            'struct': (2, 'h'),
            'dtype': 'int16',
        },
        'Int32Array': {
            'struct': (4, 'i'),
            'dtype': 'int32',
        },
        'Uint8Array': {
            'struct': (1, 'B'),
            'dtype': 'uint8',
        },
        'Uint16Array': {
            'struct': (2, 'H'),
            'dtype': 'uint16',
        },
        'Uint32Array': {
            'struct': (4, 'I'),
            'dtype': 'uint32',
        },
        'Float32Array': {
            'struct': (4, 'f'),
            'dtype': 'float32',
        },
        'Float64Array': {
            'struct': (8, 'd'),
            'dtype': 'float64',
        },
    }

    size, fmt = js_to_py_type[jstype]['struct']
    dtype = np.dtype(js_to_py_type[jstype]['dtype'])
    # sanity
    assert len(blob) % size == 0
    full_fmt = '<{0}{1}'.format(int(len(blob) / size), fmt)
    return np.array(struct.unpack(full_fmt, blob), dtype=dtype, copy=False)

def unpack_data_arrays(vtk_obj):
    if isinstance(vtk_obj, list):
        for i, v in enumerate(vtk_obj):
            vtk_obj[i] = unpack_data_arrays(v)
    elif isinstance(vtk_obj, dict):
        if 'vtkClass' in vtk_obj and vtk_obj['vtkClass'] == 'vtkDataArray':
            vtk_obj['values'] = _vtkjs_type_convert(vtk_obj['values'], vtk_obj['dataType'])
        else:
            for k in vtk_obj:
                vtk_obj[k] = unpack_data_arrays(vtk_obj[k])
    return vtk_obj

# converts vtk.js object to an itk image, if valid
def vtkjs_to_itk_image(vtkObject):
    if vtkObject['vtkClass'] == 'vtkImageData':
        imgArr = vtkObject['pointData']['arrays'][0]['data']['values']
        # numpy indexes in ZYX order, where X varies the fastest
        dims = [
            vtkObject['extent'][5] - vtkObject['extent'][4] + 1,
            vtkObject['extent'][3] - vtkObject['extent'][2] + 1,
            vtkObject['extent'][1] - vtkObject['extent'][0] + 1,
        ]
        direction = np.zeros((3,3))
        # why the direction is a json object instead of an array, nobody knows...
        # (actually I think it's b/c "direction" is stored as a Float32Array in vtkjs)
        for x in range(3):
            for y in range(3):
                direction[x][y] = vtkObject['direction'][str(x*3+y)]

        itkImage = itk.GetImageFromArray(np.reshape(imgArr, dims))
        # https://discourse.itk.org/t/set-image-direction-from-numpy-array/844/10
        vnlmat = itk.GetVnlMatrixFromArray(direction)
        itkImage.GetDirection().GetVnlMatrix().copy_in(vnlmat.data_block())
        itkImage.SetOrigin(vtkObject['origin'])
        itkImage.SetSpacing(vtkObject['spacing'])
        return itkImage
    return None

def make_guid():
    return 'guid:{}'.format(random.random())

def objdir_wrap(func):
    def handler(self, *args):
        newargs = [None] * len(args)
        for i, arg in enumerate(args):
            if type(arg) == dict and '__objguid__' in arg:
                guid = arg['__objguid__']
                newargs[i] = self.objdir_get(guid)
            else:
                newargs[i] = arg
        return func(self, *newargs)
    return handler

class ObjectProtocol(LinkProtocol):
    def __init__(self):
        super(ObjectProtocol, self).__init__()
        self.objdir = {}

    def objdir_get(self, guid):
        if guid in self.objdir:
            return self.objdir[guid]
        raise Exception('No object with guid {}'.format(guid))

    @rpc('objdir_put')
    def objdir_put(self, obj, guid=None):
        if 'vtkClass' in obj:
            obj = unpack_data_arrays(obj)
        if guid is None:
            guid = make_guid()
        self.objdir[guid] = obj
        return guid
