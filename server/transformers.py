import sys
import struct
import random

import numpy as np
import itk

from serializable import serializer, unserializer

def print_matrix(itkmat, size=(3, 3)):
    for i in range(size[0]):
        for j in range(size[1]):
            sys.stdout.write('{} '.format(itkmat(i, j)))
        sys.stdout.write('\n')

def is_itk_image(o):
    return type(o).__name__.startswith('itkImage')

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
    return _python_to_js[mangle]

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

###############
# Serializers #
###############

@serializer(lambda k, v: is_itk_image(v))
def itk_to_vtk_image(key, itk_image):
    dims = list(itk_image.GetLargestPossibleRegion().GetSize())
    extent = []
    for v in dims:
        extent.append(0)
        extent.append(v - 1)

    values = itk.GetArrayFromImage(itk_image).flatten(order='C')

    return {
        'vtkClass': 'vtkImageData',
        'spacing': list(itk_image.GetSpacing()),
        'origin': list(itk_image.GetOrigin()),
        'extent': extent,
        'direction': list(
            itk.GetArrayFromVnlMatrix(itk_image.GetDirection().GetVnlMatrix().as_matrix()).flatten()),
        'pointData': {
            'values': values,
            'dataType': _itk_image_to_type(itk_image),
            'numberOfComponents': itk_image.GetNumberOfComponentsPerPixel(),
        },
    }

@serializer(lambda k, v: type(v).__name__ == 'itkTubeSpatialObject3')
def serialize_tube(key, tube):
    tube_points = []
    for i in range(tube.GetNumberOfPoints()):
        point = tube.GetPoint(i)
        tube_points.append({
            'point': list(point.GetPositionInObjectSpace()),
            'radius': point.GetRadiusInObjectSpace(),
        })

    return {
        'id': tube.GetId(),
        'points': tube_points,
        'color': list(tube.GetProperty().GetColor()),
        'parent': tube.GetParentId(),
    }

#################
# Unserializers #
#################

@unserializer(lambda k, v: v['vtkClass'] == 'vtkImageData')
def vtk_to_itk_image(key, vtk_image):
    pixel_data = vtk_image['pointData']['values']
    pixel_type = vtk_image['pointData']['dataType']

    pixel_data = _vtkjs_type_convert(pixel_data, pixel_type)

    # numpy indexes in ZYX order, where X varies the fastest
    dims = [
        vtk_image['extent'][5] - vtk_image['extent'][4] + 1,
        vtk_image['extent'][3] - vtk_image['extent'][2] + 1,
        vtk_image['extent'][1] - vtk_image['extent'][0] + 1,
    ]

    direction = np.zeros((3,3))
    for x in range(3):
        for y in range(3):
            direction[x][y] = vtk_image['direction'][x*3+y]

    itkImage = itk.GetImageFromArray(np.reshape(pixel_data, dims))
    # https://discourse.itk.org/t/set-image-direction-from-numpy-array/844/10
    vnlmat = itk.GetVnlMatrixFromArray(direction)
    itkImage.GetDirection().GetVnlMatrix().copy_in(vnlmat.data_block())
    itkImage.SetOrigin(vtk_image['origin'])
    itkImage.SetSpacing(vtk_image['spacing'])

    return itkImage


#@adapter(lambda o: o['vtkClass'] == 'vtkLabelMap' and is_itk_image(o['imageRepresentation']),
#        attachments=True)
#def serialize_labelmap(labelmap, addAttachment):
#    labelmap['imageRepresentation'] = itk_to_vtk_image(labelmap['imageRepresentation'], addAttachment)
#    return labelmap
#
#@adapter(lambda o: o['vtkClass'] == 'vtkLabelMap' and type(o['imageRepresentation']) is dict)
#def unserialize_labelmap(labelmap):
#    labelmap['imageRepresentation'] = vtk_to_itk_image(labelmap['imageRepresentation'])
#    return labelmap
#
