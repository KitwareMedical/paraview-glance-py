import sys
import itk
import random

import numpy as np

from helper import Api, rpc

class AlgorithmApi(Api):
    def __init__(self):
        super().__init__()

    @rpc('get_parameters')
    def params(self):
        return [
            {
                'name': 'input_image',
                'label': 'Input image',
                'type': 'source',
            },
            {
                'name': 'input_labelmap',
                'label': 'Input labelmap',
                'type': 'source',
            },
            {
                'name': 'median_filter_radius',
                'label': 'Median filter radius',
                'type': 'range',
                'range': [0, 5],
                'step': 1,
                'default': 2,
            },
            {
                'name': 'hole_fill_iterations',
                'label': 'Hole fill iterations',
                'type': 'range',
                'range': [1, 20],
                'step': 1,
                'default': 10,
            },
            {
                'name': 'invert',
                'label': 'Invert',
                'type': 'bool',
                'default': False,
            },
        ]

    @rpc('run')
    def run(self, params):
        input_image = params['input_image']
        labelmap = params['input_labelmap']

        if not input_image or not labelmap:
            raise Exception('No input image or labelmap!')

        ImageType = type(input_image)

        LabelMapType = type(labelmap)

        print("Filtering...")
        median_filter = itk.MedianImageFilter[ImageType, ImageType].New()
        median_filter.SetInput(input_image)
        median_filter.SetRadius(params['median_filter_radius'])
        median_filter.Update()
        out_image = median_filter.GetOutput()

        arr_image = itk.GetArrayFromImage(out_image)
        arr_labelmap = itk.GetArrayFromImage(labelmap)

        imageMin = int(np.amin(arr_image))
        imageMax = int(np.amax(arr_image))

        ids = np.unique(arr_labelmap)
        if ids.size < 3:
            raise Exception("ERROR: Please paint at least two colors.")

        print("Segmenting...")
        objectId = ids[1]
        notObjectIds = ids[2:]

        objectIndx = np.argwhere(arr_labelmap == objectId)
        objectV = arr_image[objectIndx[:,0],objectIndx[:,1],objectIndx[:,2]]
        objectMean = np.mean(objectV)
        objectStd = np.std(objectV)
        objectCount = objectV.size

        threshLow = int(objectMean - 4 * objectStd)
        if threshLow < imageMin:
            threshLow = imageMin
        threshHigh = int(objectMean + 4 * objectStd)
        if threshHigh > imageMax:
            threshHigh = imageMax

        bestLowErr = 1
        bestHighErr = 1
        for i in notObjectIds:
            indx = np.argwhere(arr_labelmap == i)
            iV = arr_image[indx[:,0],indx[:,1],indx[:,2]]
            iMean = np.mean(iV)
            iCount = iV.size
            if iMean < objectMean:
                for t in range(int(threshLow),int(objectMean)):
                    iErr = np.count_nonzero(iV>t) / iCount
                    objectErr = np.count_nonzero(objectV<t) / objectCount
                    if iErr + objectErr < bestLowErr:
                        threshLow = t
                        bestLowErr = iErr + objectErr
            else:
                iters = range(int(objectMean),int(threshHigh))
                for t in iters[::-1]:
                    iErr = np.count_nonzero(iV<t) / iCount
                    objectErr = np.count_nonzero(objectV>t) / objectCount
                    if iErr + objectErr < bestHighErr:
                        threshHigh = t
                        bestHighErr = iErr + objectErr
        print("Object range = ", threshLow, " - ", threshHigh)
        print("   Errors = ", bestLowErr, " - ", bestHighErr)

        connected = itk.ConnectedThresholdImageFilter[ImageType, LabelMapType].New(out_image)
        connected.SetLower(int(threshLow))
        connected.SetUpper(int(threshHigh))
        connected.SetReplaceValue(int(objectId))
        for i in range(0,objectIndx[:,0].size):
            coord = itk.Index[3]()
            coord[0] = int(objectIndx[i,0])
            coord[1] = int(objectIndx[i,1])
            coord[2] = int(objectIndx[i,2])
            connected.AddSeed(coord)
        print("Object growing...")
        connected.Update()

        holeFill = itk.VotingBinaryIterativeHoleFillingImageFilter[LabelMapType].New(connected.GetOutput())
        holeFill.SetForegroundValue(int(objectId))
        holeFill.SetBackgroundValue(0)
        holeFill.SetMaximumNumberOfIterations(params['hole_fill_iterations'])
        print("Hole filling...")
        holeFill.Update()

        out_labelmap = holeFill.GetOutput()

        if params['invert']:
            invert = itk.InverIntensityImageFilter[LabelMapType].New(holeFill.GetOutput())
            invert.SetMaximum(int(objectId))
            print("Inverting...")
            invert.Update()
            out_labelmapimage = invert.GetOuput()
            out_labelmap = invert.GetOutput()

        print("Done!")


        return {
            'datasets': [
                {
                    'name': 'Output image',
                    'dataset': out_image,
                },
                {
                    'name': 'Output labelmap',
                    'dataset': out_labelmap,
                    'type': 'LabelMap',
                },
            ],
        }
