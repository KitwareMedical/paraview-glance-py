import itk
from wslink import register as rpc

import helper

class Protocol(helper.ObjectProtocol):
    @rpc('median_filter')
    @helper.objdir_wrap
    def median_filter(self, image, radius):
        itk_image = helper.vtkjs_to_itk_image(image)
        
        median_filter = itk.MedianImageFilter[type(itk_image), type(itk_image)].New()
        median_filter.SetInput(itk_image)
        median_filter.SetRadius(radius)
        median_filter.Update()

        result = median_filter.GetOutput()

        # TODO auto-serialize in objdir_wrap?
        return helper.itk_to_vtkjs_image(result)

    @rpc('segment')
    @helper.objdir_wrap
    def segment(self, image, point):
        itk_image = helper.vtkjs_to_itk_image(image)

        print('segment at:', point)

        return [
            {'point': [0, 10, 10], 'radius': 10},
            {'point': [1, 11, 11], 'radius': 20},
            {'point': [1, 12, 12], 'radius': 30},
            {'point': [0, 13, 13], 'radius': 40},
            {'point': [0, 14, 14], 'radius': 50},
            ]
