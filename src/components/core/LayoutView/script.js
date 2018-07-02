import { mapState } from 'vuex';

import { VIEW_TYPES } from 'paraview-glance/src/components/core/VtkView/constants';
import VtkView from 'paraview-glance/src/components/core/VtkView';
import viewHelper from 'paraview-glance/src/components/core/VtkView/helper';
import { Events } from 'paraview-glance/src/constants';

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

function swapOrder(order, index, newType) {
  const result = order.slice();
  const oldViewType = result[index];
  const destIndex = result.indexOf(newType);
  result[index] = newType;
  result[destIndex] = oldViewType;
  return result;
}

// ----------------------------------------------------------------------------
// Component API
// ----------------------------------------------------------------------------

function updateLayout({ index, count, newType }) {
  if (newType) {
    // swap views
    this.order = swapOrder(this.order, index, newType);
  } else if (count === 1) {
    // Shrink
    this.order = swapOrder(this.order, 0, this.order[index]);
  } else if (index === 0 && count === 2) {
    // Current view should appear as second
    this.order = swapOrder(this.order, index, this.order[1]);
  } else if (this.views.length === 4 && count === 2 && index !== 1) {
    this.order = [this.order[2], this.order[3], this.order[0], this.order[1]];
  }
  this.updateViews(count);
  this.$globalBus.$emit(Events.LAYOUT_CHANGE);
}

// ----------------------------------------------------------------------------

function updateViews(count = 1) {
  this.views = this.order
    .filter((v, i) => i < count)
    .map((t) => viewHelper.getView(this.proxyManager, t));

  // initialize viewData for new views
  this.views.forEach((view) => {
    const viewId = view.getProxyId();
    if (!(viewId in this.viewData)) {
      this.viewData = Object.assign({}, this.viewData, {
        [viewId]: {
          background: this.globalBackgroundColor,
        },
      });
    }
  });
}

// ----------------------------------------------------------------------------

function setViewBackground(view, bg) {
  this.viewData[view.getProxyId()] = Object.assign(
    {},
    this.viewData[view.getProxyId()],
    {
      background: bg,
    }
  );
}

// ----------------------------------------------------------------------------

function onMounted() {
  if (this.views.length === 0) {
    this.updateViews();
  }
}

// ----------------------------------------------------------------------------

export default {
  name: 'LayoutView',
  inject: ['$globalBus'],
  props: {
    proxyManager: { required: true },
    widgetManager: { required: true },
  },
  data: () => ({
    views: [],
    viewData: {},
    order: VIEW_TYPES.map((v) => v.value),
  }),
  computed: mapState({
    gridTemplateRows() {
      return this.views.length < 4 ? '1fr' : '1fr 1fr';
    },
    gridTemplateColumns() {
      return this.views.length < 2 ? '1fr' : '1fr 1fr';
    },
    globalBackgroundColor: (state) => state.global.backgroundColor,
  }),
  watch: {
    globalBackgroundColor(color) {
      this.proxyManager
        .getViews()
        .forEach((view) => this.setViewBackground(view, color));
      this.$forceUpdate();
    },
  },
  methods: {
    onMounted,
    updateLayout,
    updateViews,
    setViewBackground,
  },
  components: {
    VtkView,
  },
  created() {
    this.subscriptions = [
      // reset cameras when first source is added
      this.proxyManager.onProxyRegistrationChange(({ action, proxyGroup }) => {
        if (
          proxyGroup === 'Sources' &&
          action === 'register' &&
          this.proxyManager.getSources().length === 1
        ) {
          this.proxyManager.resetCameraInAllViews();
        }
      }),
    ];
  },
  mounted() {
    this.$nextTick(this.onMounted);
  },
  updated() {
    this.proxyManager.resizeAllViews();
  },
  beforeDestroy() {
    while (this.subscriptions.length) {
      this.subscriptions.pop().unsubscribe();
    }
  },
};
