import React, { useMemo } from 'react';
import { S } from '../../constants/styles';
import { TASK_LABELS } from '../../constants/taskSchemas';

/**
 * 动作库标签页组件 - v3.0 Structured Actions
 * 显示和管理动作预设库（基于 target + action_name）
 */
const LibraryTab = React.memo(function LibraryTab({
  taskType,
  actionLib,
  searchValue,
  onSearchChange
}) {
  // 过滤和排序动作库
  const filteredLib = useMemo(() => {
    const lib = actionLib[taskType] || [];
    const search = searchValue.trim().toLowerCase();
    const filtered = search
      ? lib.filter((e) => 
          (e.target && e.target.toLowerCase().includes(search)) ||
          (e.action_name && e.action_name.toLowerCase().includes(search))
        )
      : lib;
    return filtered.sort((a, b) => b.use_count - a.use_count);
  }, [actionLib, taskType, searchValue]);

  const totalCount = (actionLib[taskType] || []).length;

  // 按 target 分组统计
  const targetGroups = useMemo(() => {
    const groups = {};
    filteredLib.forEach(entry => {
      const target = entry.target || 'unknown';
      if (!groups[target]) {
        groups[target] = [];
      }
      groups[target].push(entry);
    });
    return groups;
  }, [filteredLib]);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 20,
      }}
    >
      <div style={{ ...S.card, padding: 16, maxWidth: 560 }}>
        {/* Header */}
        <div
          style={{
            fontSize: 10,
            color: '#444',
            letterSpacing: '1px',
            marginBottom: 14,
          }}
        >
          动作预设库 — {TASK_LABELS[taskType]} · {totalCount} 条
        </div>

        {/* Search Input */}
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索目标对象或动作名称..."
          style={{ ...S.input, marginBottom: 12 }}
          aria-label="搜索动作"
        />

        {/* Empty State */}
        {filteredLib.length === 0 && (
          <div
            style={{
              color: '#2a2a2a',
              fontSize: 12,
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            暂无动作记录
          </div>
        )}

        {/* Grouped Action List */}
        {Object.entries(targetGroups).map(([target, entries]) => (
          <div key={target} style={{ marginBottom: 16 }}>
            {/* Target Header */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#f59e0b',
                padding: '6px 0',
                borderBottom: '1px solid #f59e0b33',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {target}
            </div>

            {/* Actions for this target */}
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid #e5e5e5',
                }}
              >
                {/* Action Name */}
                <div style={{ flex: 1, fontSize: 12, color: '#333' }}>
                  <span style={{ fontWeight: 500 }}>{entry.action_name}</span>
                  <span style={{ color: '#999', marginLeft: 8, fontSize: 10 }}>
                    by {entry.created_by}
                  </span>
                </div>

                {/* Use Count */}
                <div
                  style={{
                    fontSize: 10,
                    color: '#f59e0b',
                    background: '#fef3c7',
                    padding: '2px 8px',
                    borderRadius: 2,
                    border: '1px solid #fbbf24',
                  }}
                >
                  ×{entry.use_count}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

export default LibraryTab;
