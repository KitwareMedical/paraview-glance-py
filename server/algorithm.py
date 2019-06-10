import sys
sys.path.insert(0, '/home/forrestli/ITK/build/Wrapping/Generators/Python')
sys.path.insert(1, '/home/forrestli/ITK/build/lib')
sys.path.insert(2, '/home/forrestli/ITKTubeTK/build2/lib')

import itk
import random

from helper2 import Api, rpc

class AlgorithmApi(Api):
    def __init__(self):
        super().__init__()

    @rpc('get_parameters')
    def params(self):
        return [
            {
                'name': 'some_num_range',
                'label': 'some num range',
                'type': 'range',
                'range': [0, 100],
                'step': 1,
                'default': 50,
            },
            {
                'name': 'some_bool',
                'label': 'some bool',
                'type': 'bool',
                'default': True,
            },
        ]

    @rpc('run')
    def run(self, input_image, input_labelmap, params=None):
        params = params or dict()

        ImageType = type(input_image)
        out_image = itk.CastImageFilter[ImageType, ImageType].New()(input_image)

        labelmap = input_labelmap['imageRepresentation']
        ImageType = type(labelmap)
        out_labelmap = dict(input_labelmap)
        out_labelmap['imageRepresentation'] = \
                itk.CastImageFilter[ImageType, ImageType].New()(labelmap)

        return {
            'image': out_image,
            'imageName': 'Output image',
            'labelmap': out_labelmap,
            'labelmapName': 'Output labelmap',
        }
