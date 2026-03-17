// ─── Task Schemas ────────────────────────────────────────────

export const TASK_SCHEMAS = {
  drawer: {
    drawer_state: { type: "enum", options: ["closed", "half_open", "fully_open"], label: "抽屉状态" },
    mug_state: { type: "enum", options: ["on table", "in drawer", "none"], label: "杯子的状态" },
    // object_in_hand: { type: "text", label: "手持物体", placeholder: "red_block / None" },
  },
  coffee_machine: {
    machine_state: { type: "enum", options: ["off", "idle", "brewing"], label: "机器状态" },
    cup_position: { type: "enum", options: ["absent", "under_spout", "held"], label: "杯子位置" },
  },
  water: {
    kettle_state: { type: "enum", options: ["off", "heating", "boiled"], label: "水壶状态" },
    water_level: { type: "enum", options: ["empty", "low", "full"], label: "水位" },
  },
  gift: {
    box_state: { type: "enum", options: ["closed", "open"], label: "盒子状态" },
  }
};

export const TASK_LABELS = {
  drawer: "拉抽屉",
  coffee_machine: "咖啡机操作",
  water: "水壶操作",
  gift: "打开礼物盒",
};
