import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

import {
  registerReplacer,
  registerReviver,
} from 'paraview-glance/src/serializable';

// replacer methods ------------------------------------------------------------

function fromVtkDataArray(key, da) {
  if (da && da.isA && da.isA('vtkDataArray')) {
    return {
      vtkClass: 'vtkDataArray',
      numberOfComponents: da.getNumberOfComponents(),
      dataType: da.getDataType(),
      values: da.getData(),
    };
  }
  return undefined;
}
registerReplacer(fromVtkDataArray);

function fromVtkImage(key, image) {
  if (image && image.isA && image.isA('vtkImageData')) {
    return {
      vtkClass: 'vtkImageData',
      origin: image.getOrigin(),
      spacing: image.getSpacing(),
      direction: Array.from(image.getDirection()),
      extent: image.getExtent(),
      pointData: image.getPointData().getArrays()[0],
    };
  }
  return undefined;
}
registerReplacer(fromVtkImage);

function fromVtkLabelMap(key, lm) {
  if (lm && lm.isA && lm.isA('vtkLabelMap')) {
    return {
      vtkClass: 'vtkLabelMap',
      colorMap: lm.getColorMap(),
      imageRepresentation: lm.getImageRepresentation(),
    };
  }
  return undefined;
}
registerReplacer(fromVtkLabelMap);

// reviver methods ------------------------------------------------------------

function toVtkImage(key, value) {
  if (value && value.vtkClass === 'vtkImageData') {
    const { values: pointData } = value.pointData;

    const image = vtkImageData.newInstance({
      origin: value.origin,
      spacing: value.spacing,
      direction: value.direction,
      extent: value.extent,
    });

    image.getPointData().setScalars(
      vtkDataArray.newInstance({
        numberOfComponents: value.pointData.numberOfComponents,
        values: pointData,
      })
    );

    return image;
  }
  return undefined;
}
registerReviver(toVtkImage);
