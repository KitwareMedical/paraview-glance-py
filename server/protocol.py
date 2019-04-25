import itk
from wslink import register as rpc
import random

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

    @rpc('segment')
    @helper.deferResults
    @helper.objdir_wrap
    def segment(self, image, point, scale):
        extradata = self.objdir_get_extradata(image)
        ii = extradata.get('ii', 0)

        itk_image = helper.vtkjs_to_itk_image(image)

        print('segment at:', point)

        ii += 1
        extradata['ii'] = ii
        print(id(image), extradata)

        bx = random.randint(0, 50)
        by = random.randint(0, 50)
        bz = random.randint(0, 50)

        return {
            'id': ii,
            'points': [
                { 'point': [bx, by+4, bz+4], 'radius': 3 },
                { 'point': [bx+1, by+11, bz+11], 'radius': 4 },
                { 'point': [bx+1, by+15, bz+15], 'radius': 4 },
                { 'point': [bx, by+18, bz+18], 'radius': 3 },
                { 'point': [bx, by+24, bz+24], 'radius': 4 },
            ],
        }
