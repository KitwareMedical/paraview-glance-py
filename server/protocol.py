import itk
from wslink import register as rpc

import helper

class Protocol(helper.ObjectProtocol):
    @rpc('median_filter') # method is available via 'median_filter' rpc name
    @helper.deferResults # median filter is slow, so defer results
    @helper.objdir_wrap # image is cached via object directory
    def median_filter(self, image, radius):
        itk_image = helper.vtkjs_to_itk_image(image)
        
        median_filter = itk.MedianImageFilter[type(itk_image), type(itk_image)].New()
        median_filter.SetInput(itk_image)
        median_filter.SetRadius(radius)
        median_filter.Update()

        result = median_filter.GetOutput()

        # maybe auto-serialize in objdir_wrap?
        return helper.itk_to_vtkjs_image(
                result,
                'Median filter of {}'.format(image['name']))
