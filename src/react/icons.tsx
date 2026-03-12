import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import TransformIcon from '@mui/icons-material/Transform';
import BarChartIcon from '@mui/icons-material/BarChart';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import CompressIcon from '@mui/icons-material/Compress';
import DeblurIcon from '@mui/icons-material/Deblur';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import type { OperationType } from './types';

const ICON_MAP: Record<OperationType, React.ComponentType<{ sx?: object }>> = {
  where:     FilterListIcon,
  distinct:  DeblurIcon,
  select:    ViewColumnIcon,
  map:       TransformIcon,
  flatten:   UnfoldLessIcon,
  transpose: SwapHorizIcon,
  sort:      SwapVertIcon,
  groupBy:   WorkspacesIcon,
  reduce:    CompressIcon,
  rollup:    BarChartIcon,
  pivot:     PivotTableChartIcon,
  first:     VerticalAlignTopIcon,
  last:      VerticalAlignBottomIcon,
  join:      MergeTypeIcon,
};

export function OperationIcon({ type, size = 16 }: { type: OperationType; size?: number }) {
  const Icon = ICON_MAP[type];
  return <Icon sx={{ fontSize: size }} />;
}
