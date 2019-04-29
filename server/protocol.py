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

        itk_image = helper.vtkjs_to_itk_image(image)
        # maybe I should have a set of associated data...?
        itk_image = itk.CastImageFilter[type(itk_image), itk.Image[itk.F, 3]].New()(itk_image)

        if 'segmenter' not in extradata:
            extradata['segmenter'] = itk.TubeTK.SegmentTubes[type(itk_image)].New()
            extradata['segmenter'].SetInputImage(itk_image)

        segmenter = extradata['segmenter']

        next_tube_id = extradata.get('next_tube_id', 1)
        tube = segmenter.ExtractTube(point, next_tube_id, True)
        if tube:
            tube_points = []
            for i in range(tube.GetNumberOfPoints()):
                point = tube.GetPoint(i)
                tube_points.append({
                    'point': list(point.GetPositionInObjectSpace()),
                    'radius': point.GetRadiusInObjectSpace(),
                })

            extradata['next_tube_id'] = next_tube_id + 1

            return {
                'id': tube.GetId(),
                'points': tube_points,
            }
        return None
