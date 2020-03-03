import macro from 'vtk.js/Sources/macro';

import vtkLabelMapSliceRepProxy from 'paraview-glance/src/vtk/LabelMapSliceRepProxy';

// ----------------------------------------------------------------------------
// vtkTubeGroupLabelMapRepresentationProxy methods
// ----------------------------------------------------------------------------

function vtkTubeGroupLabelMapRepresentationProxy(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkTubeGroupLabelMapRepresentationProxy');

  // override to return the image representation as the input dataset
  publicAPI.getInputDataSet = () =>
    model.input ? model.input.getDataset().getLabelMap() : null;

  model.sourceDependencies = model.sourceDependencies.map((dep) => ({
    setInputData: (tubeGroup) => dep.setInputData(tubeGroup.getLabelMap()),
  }));
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  /* eslint-disable-next-line import/no-named-as-default-member */
  vtkLabelMapSliceRepProxy.extend(publicAPI, model);

  // Object specific methods
  vtkTubeGroupLabelMapRepresentationProxy(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkTubeGroupLabelMapRepresentationProxy'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
