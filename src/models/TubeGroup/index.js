import macro from 'vtk.js/Sources/macro';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';

// ----------------------------------------------------------------------------
// vtkTubeGroup methods
// ----------------------------------------------------------------------------

function vtkTubeGroup(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkTubeGroup');

  // "copy" polydata to tube group
  if (model.internalPolyData) {
    Object.keys(model.internalPolyData).forEach((k) => {
      publicAPI[k] = model.internalPolyData[k];
    });
  }
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  internalPolyData: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkPolyData.extend(publicAPI, model);

  // Object specific methods
  vtkTubeGroup(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkTubeGroup');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
