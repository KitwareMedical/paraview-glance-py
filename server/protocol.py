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

    @rpc('otsu_segment_filter')
    @helper.objdir_wrap
    def otsu_segment_filter(self, image):
        print ("otsu_segment")
        
        itk_image = helper.vtkjs_to_itk_image(image)
        
        otsu_filter = itk.TubeTK.SegmentUsingOtsuThreshold[helper.itk_pixel_type(itk_image), 
                                              helper.itk_image_dimension(itk_image), 
                                              helper.itk_pixel_type(itk_image)].New()
        otsu_filter.SetInput(itk_image)
        otsu_filter.Update()

        result = otsu_filter.GetOutput()

        # TODO auto-serialize in objdir_wrap?
        return helper.itk_to_vtkjs_image(result)


    @rpc('segment')
    @helper.objdir_wrap
    def segment(self, image, point):
   
        itk_image = helper.vtkjs_to_itk_image(image)

        itk_image = itk.CastImageFilter[type(itk_image), itk.Image[itk.F, 3]].New()(itk_image)

        print('segment at:', point)

        tuber = itk.TubeTK.SegmentTubes[type(itk_image)].New()

        tuber.SetInputImage(itk_image)
        atube = tuber.ExtractTube(point, 0, True)
        
        tube_py = []
        for j in range(atube.GetNumberOfPoints()):
            pt = atube.GetPoint(j)
            pos = helper.itk_pos_to_array(pt.GetPosition())
            radius = helper.spatial_object_pt_to_radius(pt)
            tube_py.append({'point': pos, 'radius': radius},)

        return tube_py
      
