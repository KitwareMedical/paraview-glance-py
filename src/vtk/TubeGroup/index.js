import macro from 'vtk.js/Sources/macro';
import vtkDataSet from 'vtk.js/Sources/Common/DataModel/DataSet';

// ----------------------------------------------------------------------------
// vtkTubeGroup methods
// ----------------------------------------------------------------------------

function vtkTubeGroup(publicAPI, model) {
  model.classHierarchy.push('vtkTubeGroup');
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  polyData: null,
  labelMap: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkDataSet.extend(publicAPI, model);

  macro.setGet(publicAPI, model, ['polyData', 'labelMap']);

  // Object specific methods
  vtkTubeGroup(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkTubeGroup');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
