import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from "react";

import {
  Box,
  MapPin,
  Lock,
  Truck,
  Tag,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
  RefreshCw,
  Search,
  Download,
  Filter,
  SlidersHorizontal,
  MoreVertical,
  Eye,
  Printer,
  ArrowRightLeft,
  PlusCircle,
  X,
  Clock,
  Bookmark,
  RotateCcw
} from "lucide-react";

import { api } from "../../utils/api";
import { StockItemDetailsDrawer } from "./StockItemDetailsDrawer";

interface EnterpriseStockBalanceViewProps {
  warehouses: any[];
  ingredients: any[];
  onNotify?: (
    msg: string,
    type?: "success" | "error" | "info"
  ) => void;
  onNavigateToFeature?: (featureId: string) => void;
}

interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
  category:
    | "basic"
    | "quantities"
    | "costs"
    | "movements"
    | "tracking";
}

const STOCK_SNAPSHOT_KEY = "remo_stock_intelligence_snapshot";

type StockSnapshot = {
  items: any[];
  kpis: any;
  at: number;
};

let memorySnapshot: StockSnapshot | null = null;

function readStockSnapshot(): StockSnapshot | null {
  if (memorySnapshot?.items?.length) {
    return memorySnapshot;
  }

  try {
    const raw = sessionStorage.getItem(STOCK_SNAPSHOT_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as StockSnapshot;

    if (
      parsed &&
      Array.isArray(parsed.items) &&
      parsed.items.length
    ) {
      memorySnapshot = parsed;
      return parsed;
    }
  } catch {}

  return null;
}

function writeStockSnapshot(
  items: any[],
  kpis: any
) {
  const snapshot: StockSnapshot = {
    items: Array.isArray(items) ? items : [],
    kpis: kpis || {},
    at: Date.now()
  };

  memorySnapshot = snapshot;

  try {
    sessionStorage.setItem(
      STOCK_SNAPSHOT_KEY,
      JSON.stringify(snapshot)
    );
  } catch {}
}

export async function prefetchStockBalances() {
  const existing = readStockSnapshot();

  if (
    existing?.items?.length &&
    Date.now() - (existing.at || 0) < 20000
  ) {
    return;
  }

  try {
    const res = await api.get(
      "/api/inventory/stock-intelligence"
    );

    if (!res.ok) return;

    const data = await res.json();

    writeStockSnapshot(
      data?.items || [],
      data?.kpis || {}
    );
  } catch {}
}

const ALL_COLUMNS: ColumnConfig[] = [
  {
    id: "item",
    label: "الصنف والكود",
    defaultVisible: true,
    category: "basic"
  },
  {
    id: "warehouse",
    label: "المخزن",
    defaultVisible: true,
    category: "basic"
  },
  {
    id: "status",
    label: "حالة المخزون",
    defaultVisible: true,
    category: "basic"
  },
  {
    id: "location",
    label: "موقع التخزين (Bin/Rack)",
    defaultVisible: true,
    category: "basic"
  },
  {
    id: "quantity",
    label: "الكمية الحالية",
    defaultVisible: true,
    category: "quantities"
  },
  {
    id: "units_breakdown",
    label: "تعدد الوحدات",
    defaultVisible: false,
    category: "quantities"
  },
  {
    id: "available",
    label: "المتاح للصرف",
    defaultVisible: true,
    category: "quantities"
  },
  {
    id: "reserved",
    label: "المحجوز",
    defaultVisible: true,
    category: "quantities"
  },
  {
    id: "in_transit",
    label: "قيد النقل",
    defaultVisible: true,
    category: "quantities"
  },
  {
    id: "reorder",
    label: "حد الطلب (ROP/Min)",
    defaultVisible: true,
    category: "quantities"
  },
  {
    id: "consumption",
    label: "معدل الاستهلاك وأيام التغطية",
    defaultVisible: false,
    category: "quantities"
  },
  {
    id: "avg_cost",
    label: "متوسط التكلفة",
    defaultVisible: true,
    category: "costs"
  },
  {
    id: "last_price",
    label: "آخر سعر شراء",
    defaultVisible: false,
    category: "costs"
  },
  {
    id: "value",
    label: "قيمة المخزون",
    defaultVisible: true,
    category: "costs"
  },
  {
    id: "last_movement",
    label: "آخر حركة",
    defaultVisible: true,
    category: "movements"
  },
  {
    id: "last_receipt",
    label: "آخر استلام",
    defaultVisible: false,
    category: "movements"
  },
  {
    id: "last_issue",
    label: "آخر صرف",
    defaultVisible: false,
    category: "movements"
  },
  {
    id: "batches",
    label: "التشغيلات والصلاحية",
    defaultVisible: false,
    category: "tracking"
  },
  {
    id: "serials",
    label: "الأرقام التسلسلية",
    defaultVisible: false,
    category: "tracking"
  },
  {
    id: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    category: "basic"
  }
];

export const EnterpriseStockBalanceView: React.FC<
  EnterpriseStockBalanceViewProps
> = ({
  warehouses,
  ingredients,
  onNotify,
  onNavigateToFeature
}) => {
  /*
   * =========================================================
   * DATA STATE
   * =========================================================
   */

  const initialSnapshot = useMemo(
    () => readStockSnapshot(),
    []
  );

  const [items, setItems] = useState<any[]>(
    initialSnapshot?.items || []
  );

  const [kpis, setKpis] = useState<any>(
    initialSnapshot?.kpis || {}
  );

  const [loading, setLoading] = useState(
    !initialSnapshot?.items?.length
  );

  const [refreshing, setRefreshing] = useState(false);

  /*
   * Request protection.
   *
   * Every request gets a sequence number.
   * Only the latest request is allowed to update the screen.
   */
  const requestSequenceRef = useRef(0);

  const mountedRef = useRef(true);

  /*
   * =========================================================
   * FILTERS
   * =========================================================
   */

  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedWarehouse, setSelectedWarehouse] =
    useState("all");

  const [selectedCategory, setSelectedCategory] =
    useState("all");

  const [selectedStockStatus, setSelectedStockStatus] =
    useState("all");

  const [selectedItemType, setSelectedItemType] =
    useState("all");

  const [selectedBrand, setSelectedBrand] =
    useState("all");

  const [filterHasBatch, setFilterHasBatch] =
    useState(false);

  const [filterHasSerial, setFilterHasSerial] =
    useState(false);

  const [filterMinQty, setFilterMinQty] =
    useState("");

  const [filterMaxQty, setFilterMaxQty] =
    useState("");

  const [showAdvancedFilters, setShowAdvancedFilters] =
    useState(false);

  /*
   * =========================================================
   * SAVED FILTERS
   * =========================================================
   */

  const [savedFilters, setSavedFilters] =
    useState<
      Array<{
        name: string;
        filters: any;
      }>
    >([]);

  const [newFilterName, setNewFilterName] =
    useState("");

  const [showSaveFilterModal, setShowSaveFilterModal] =
    useState(false);

  /*
   * =========================================================
   * PAGINATION / SORTING
   * =========================================================
   */

  const [currentPage, setCurrentPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const [sortField, setSortField] =
    useState("ingredient_name");

  const [sortOrder, setSortOrder] =
    useState<"asc" | "desc">("asc");

  /*
   * =========================================================
   * COLUMN VISIBILITY
   * =========================================================
   */

  const [visibleColumns, setVisibleColumns] =
    useState<Record<string, boolean>>(() => {
      try {
        const saved = localStorage.getItem(
          "remo_stock_balance_cols"
        );

        if (saved) {
          return JSON.parse(saved);
        }
      } catch {}

      const defaults: Record<string, boolean> = {};

      ALL_COLUMNS.forEach(column => {
        defaults[column.id] =
          column.defaultVisible;
      });

      return defaults;
    });

  const [showColumnManager, setShowColumnManager] =
    useState(false);

  /*
   * =========================================================
   * DRAWER / MODALS
   * =========================================================
   */

  const [selectedDrawerItemId, setSelectedDrawerItemId] =
    useState<number | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] =
    useState(false);

  const [reservedModalItem, setReservedModalItem] =
    useState<any | null>(null);

  const [inTransitModalItem, setInTransitModalItem] =
    useState<any | null>(null);

  const [openMenuRowId, setOpenMenuRowId] =
    useState<number | null>(null);

  /*
   * =========================================================
   * MOUNT / UNMOUNT
   * =========================================================
   */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * =========================================================
   * LOAD SAVED FILTERS
   * =========================================================
   */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        "remo_saved_stock_filters"
      );

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setSavedFilters(parsed);
        }
      }
    } catch {}
  }, []);

  /*
   * =========================================================
   * COLUMN PREFERENCES
   * =========================================================
   */

  const saveColumnPreferences = useCallback(
    (newCols: Record<string, boolean>) => {
      setVisibleColumns(newCols);

      try {
        localStorage.setItem(
          "remo_stock_balance_cols",
          JSON.stringify(newCols)
        );
      } catch {}
    },
    []
  );

  /*
   * =========================================================
   * SAVE FILTER
   * =========================================================
   */

  const handleSaveFilter = useCallback(() => {
    if (!newFilterName.trim()) return;

    const current = {
      searchQuery,
      selectedWarehouse,
      selectedCategory,
      selectedStockStatus,
      selectedItemType,
      selectedBrand,
      filterHasBatch,
      filterHasSerial,
      filterMinQty,
      filterMaxQty
    };

    const updated = [
      ...savedFilters,
      {
        name: newFilterName.trim(),
        filters: current
      }
    ];

    setSavedFilters(updated);

    try {
      localStorage.setItem(
        "remo_saved_stock_filters",
        JSON.stringify(updated)
      );
    } catch {}

    setNewFilterName("");
    setShowSaveFilterModal(false);

    onNotify?.(
      "تم حفظ الفلتر بنجاح",
      "success"
    );
  }, [
    newFilterName,
    searchQuery,
    selectedWarehouse,
    selectedCategory,
    selectedStockStatus,
    selectedItemType,
    selectedBrand,
    filterHasBatch,
    filterHasSerial,
    filterMinQty,
    filterMaxQty,
    savedFilters,
    onNotify
  ]);

  /*
   * =========================================================
   * APPLY SAVED FILTER
   * =========================================================
   */

  const applySavedFilter = useCallback(
    (savedFilter: any) => {
      const f = savedFilter?.filters || {};

      setSearchQuery(
        f.searchQuery || ""
      );

      setSelectedWarehouse(
        f.selectedWarehouse || "all"
      );

      setSelectedCategory(
        f.selectedCategory || "all"
      );

      setSelectedStockStatus(
        f.selectedStockStatus || "all"
      );

      setSelectedItemType(
        f.selectedItemType || "all"
      );

      setSelectedBrand(
        f.selectedBrand || "all"
      );

      setFilterHasBatch(
        !!f.filterHasBatch
      );

      setFilterHasSerial(
        !!f.filterHasSerial
      );

      setFilterMinQty(
        f.filterMinQty || ""
      );

      setFilterMaxQty(
        f.filterMaxQty || ""
      );

      setCurrentPage(1);

      onNotify?.(
        `تم تطبيق الفلتر: ${savedFilter.name}`,
        "info"
      );
    },
    [onNotify]
  );

  /*
   * =========================================================
   * DELETE SAVED FILTER
   * =========================================================
   */

  const removeSavedFilter = useCallback(
    (index: number) => {
      const updated =
        savedFilters.filter(
          (_, i) => i !== index
        );

      setSavedFilters(updated);

      try {
        localStorage.setItem(
          "remo_saved_stock_filters",
          JSON.stringify(updated)
        );
      } catch {}
    },
    [savedFilters]
  );

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const cleanCode = useCallback(
    (rawCode: any, id?: any) => {
      if (
        !rawCode ||
        rawCode === "NULL" ||
        rawCode === "null" ||
        rawCode === "undefined"
      ) {
        return id
          ? `ITEM-${id}`
          : "";
      }

      const s =
        String(rawCode).trim();

      if (s.startsWith("-")) {
        return `ITEM-${s.replace("-", "")}`;
      }

      if (
        !s.startsWith("ITEM-") &&
        !isNaN(Number(s))
      ) {
        return `ITEM-${s}`;
      }

      return s;
    },
    []
  );

  const cleanStr = useCallback(
    (val: any) => {
      if (
        !val ||
        val === "NULL" ||
        val === "null" ||
        val === "undefined"
      ) {
        return null;
      }

      const s =
        String(val).trim();

      return s || null;
    },
    []
  );

  const fmt = useCallback(
    (n: any) =>
      Number(n || 0).toLocaleString(
        "en-US",
        {
          maximumFractionDigits: 2
        }
      ),
    []
  );

  const fmtMoney = useCallback(
    (n: any) =>
      `${fmt(n)} ج.م`,
    [fmt]
  );

  /*
   * =========================================================
   * FETCH STOCK DATA
   * =========================================================
   *
   * Important:
   *
   * 1. First load:
   *    show skeleton/loading.
   *
   * 2. If snapshot exists:
   *    keep existing rows visible.
   *
   * 3. Refresh:
   *    never clear the existing table.
   *
   * 4. Latest request wins.
   * =========================================================
   */

  const fetchData = useCallback(
    async (
      options: {
        silent?: boolean;
        notify?: boolean;
      } = {}
    ) => {
      const {
        silent = false,
        notify = false
      } = options;

      const requestId =
        ++requestSequenceRef.current;

      const hasCurrentData =
        items.length > 0;

      if (!silent && !hasCurrentData) {
        setLoading(true);
      }

      setRefreshing(true);

      try {
        const params =
          new URLSearchParams();

        if (
          selectedWarehouse !== "all"
        ) {
          params.append(
            "warehouse_id",
            selectedWarehouse
          );
        }

        if (
          selectedCategory !== "all"
        ) {
          params.append(
            "category",
            selectedCategory
          );
        }

        if (
          selectedStockStatus !== "all"
        ) {
          params.append(
            "stock_status",
            selectedStockStatus
          );
        }

        if (
          selectedItemType !== "all"
        ) {
          params.append(
            "item_type",
            selectedItemType
          );
        }

        if (
          selectedBrand !== "all"
        ) {
          params.append(
            "brand",
            selectedBrand
          );
        }

        if (searchQuery.trim()) {
          params.append(
            "search",
            searchQuery.trim()
          );
        }

        if (filterHasBatch) {
          params.append(
            "has_batch",
            "true"
          );
        }

        if (filterHasSerial) {
          params.append(
            "has_serial",
            "true"
          );
        }

        if (filterMinQty !== "") {
          params.append(
            "min_qty",
            filterMinQty
          );
        }

        if (filterMaxQty !== "") {
          params.append(
            "max_qty",
            filterMaxQty
          );
        }

        const query =
          params.toString();

        const url =
          `/api/inventory/stock-intelligence${
            query
              ? `?${query}`
              : ""
          }`;

        const res =
          await api.get(url);

        /*
         * Ignore stale response.
         */
        if (
          requestId !==
          requestSequenceRef.current
        ) {
          return;
        }

        if (res.ok) {
          const data =
            await res.json();

          const nextItems =
            Array.isArray(data?.items)
              ? data.items
              : [];

          const nextKpis =
            data?.kpis || {};

          if (!mountedRef.current) {
            return;
          }

          setItems(nextItems);
          setKpis(nextKpis);

          /*
           * Save only successful
           * responses.
           */
          writeStockSnapshot(
            nextItems,
            nextKpis
          );

          if (notify) {
            onNotify?.(
              "تم تحديث أرصدة المخزون بنجاح",
              "success"
            );
          }

          return;
        }

        /*
         * =====================================================
         * FALLBACK API
         * =====================================================
         */

        const fallbackParams =
          selectedWarehouse !== "all"
            ? `?warehouse_id=${encodeURIComponent(
                selectedWarehouse
              )}`
            : "";

        const basicRes =
          await api.get(
            `/api/inventory-items${fallbackParams}`
          );

        if (
          requestId !==
          requestSequenceRef.current
        ) {
          return;
        }

        if (basicRes.ok) {
          const basicData =
            await basicRes.json();

          const basicItems =
            Array.isArray(basicData)
              ? basicData
              : Array.isArray(
                  basicData?.data
                )
              ? basicData.data
              : [];

          if (!mountedRef.current) {
            return;
          }

          setItems(basicItems);

          /*
           * Do not destroy existing KPI
           * information if fallback API
           * does not provide KPI data.
           */
          writeStockSnapshot(
            basicItems,
            kpis
          );

          if (notify) {
            onNotify?.(
              "تم تحميل أرصدة المخزون من المصدر الاحتياطي",
              "info"
            );
          }
        }
      } catch (error) {
        console.error(
          "Stock intelligence fetch error:",
          error
        );

        /*
         * IMPORTANT:
         *
         * Do not erase existing successful
         * data when refresh fails.
         */
        if (
          requestId ===
            requestSequenceRef.current &&
          !items.length
        ) {
          onNotify?.(
            "فشل تحميل أرصدة المخزون",
            "error"
          );
        } else if (notify) {
          onNotify?.(
            "تعذر تحديث البيانات، وتم الاحتفاظ بآخر بيانات ناجحة",
            "error"
          );
        }
      } finally {
        if (
          requestId ===
            requestSequenceRef.current &&
          mountedRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      items.length,
      selectedWarehouse,
      selectedCategory,
      selectedStockStatus,
      selectedItemType,
      selectedBrand,
      searchQuery,
      filterHasBatch,
      filterHasSerial,
      filterMinQty,
      filterMaxQty,
      kpis,
      onNotify
    ]
  );

  /*
   * =========================================================
   * AUTO LOAD
   * =========================================================
   */

  useEffect(() => {
    setCurrentPage(1);

    /*
     * Keep current data visible
     * while fetching new filtered data.
     */
    fetchData({
      silent: true,
      notify: false
    });
  }, [
    selectedWarehouse,
    selectedCategory,
    selectedStockStatus,
    selectedItemType,
    selectedBrand,
    filterHasBatch,
    filterHasSerial,
    searchQuery,
    filterMinQty,
    filterMaxQty
  ]);

  /*
   * =========================================================
   * CLIENT SIDE SAFETY FILTERING
   * =========================================================
   */

  const filteredItems = useMemo(() => {
    let result = items;

    /*
     * Warehouse
     */
    if (
      selectedWarehouse !== "all"
    ) {
      result =
        result.filter(
          item =>
            String(
              item.warehouse_id
            ) ===
            String(
              selectedWarehouse
            )
        );
    }

    /*
     * Stock status
     */
    if (
      selectedStockStatus !== "all"
    ) {
      result =
        result.filter(
          item =>
            item.status ===
            selectedStockStatus
        );
    }

    /*
     * Category
     */
    if (
      selectedCategory !== "all"
    ) {
      result =
        result.filter(
          item =>
            cleanStr(
              item.category
            ) ===
            selectedCategory
        );
    }

    /*
     * Brand
     */
    if (
      selectedBrand !== "all"
    ) {
      result =
        result.filter(
          item =>
            cleanStr(
              item.brand
            ) ===
            selectedBrand
        );
    }

    /*
     * Item type
     */
    if (
      selectedItemType !== "all"
    ) {
      result =
        result.filter(
          item =>
            item.item_type ===
            selectedItemType
        );
    }

    /*
     * Search
     */
    if (
      searchQuery.trim()
    ) {
      const q =
        searchQuery
          .toLowerCase()
          .trim();

      result =
        result.filter(item => {
          const name =
            (
              item.ingredient_name ||
              item.name ||
              ""
            )
              .toString()
              .toLowerCase();

          const code =
            String(
              cleanCode(
                item.ingredient_code ||
                  item.item_code ||
                  item.code,
                item.ingredient_id ||
                  item.id
              )
            ).toLowerCase();

          const barcode =
            String(
              item.barcode || ""
            ).toLowerCase();

          const sku =
            String(
              item.sku ||
                item.item_sku ||
                ""
            ).toLowerCase();

          const warehouseName =
            (
              item.warehouse_name ||
              ""
            )
              .toString()
              .toLowerCase();

          return (
            name.includes(q) ||
            code.includes(q) ||
            barcode.includes(q) ||
            sku.includes(q) ||
            warehouseName.includes(q)
          );
        });
    }

    /*
     * Batch
     */
    if (filterHasBatch) {
      result =
        result.filter(
          item =>
            Number(
              item.batch_count || 0
            ) > 0
        );
    }

    /*
     * Serial
     */
    if (filterHasSerial) {
      result =
        result.filter(
          item =>
            Number(
              item.serial_count || 0
            ) > 0
        );
    }

    /*
     * Minimum quantity
     */
    if (
      filterMinQty !== ""
    ) {
      const min =
        Number(
          filterMinQty
        );

      if (!isNaN(min)) {
        result =
          result.filter(
            item =>
              Number(
                item.quantity || 0
              ) >= min
          );
      }
    }

    /*
     * Maximum quantity
     */
    if (
      filterMaxQty !== ""
    ) {
      const max =
        Number(
          filterMaxQty
        );

      if (!isNaN(max)) {
        result =
          result.filter(
            item =>
              Number(
                item.quantity || 0
              ) <= max
          );
      }
    }

    return result;
  }, [
    items,
    selectedWarehouse,
    selectedStockStatus,
    selectedCategory,
    selectedBrand,
    selectedItemType,
    searchQuery,
    filterHasBatch,
    filterHasSerial,
    filterMinQty,
    filterMaxQty,
    cleanStr,
    cleanCode
  ]);

  /*
   * =========================================================
   * SORTING
   * =========================================================
   */

  const sortedItems = useMemo(() => {
    return [
      ...filteredItems
    ].sort((a, b) => {
      let valA =
        a?.[sortField];

      let valB =
        b?.[sortField];

      /*
       * Nested last movement date.
       */
      if (
        sortField ===
        "last_movement"
      ) {
        valA =
          a?.last_movement?.date ||
          "";

        valB =
          b?.last_movement?.date ||
          "";
      }

      /*
       * Numeric values.
       */
      const numericFields = [
        "quantity",
        "available",
        "reserved",
        "in_transit",
        "reorder_point",
        "min_stock",
        "max_stock",
        "avg_cost",
        "last_purchase_price",
        "inventory_value",
        "daily_avg_consumption",
        "days_of_supply"
      ];

      if (
        numericFields.includes(
          sortField
        )
      ) {
        const numA =
          Number(valA || 0);

        const numB =
          Number(valB || 0);

        return sortOrder ===
          "asc"
          ? numA - numB
          : numB - numA;
      }

      const stringA =
        String(
          valA ?? ""
        );

      const stringB =
        String(
          valB ?? ""
        );

      return sortOrder ===
        "asc"
        ? stringA.localeCompare(
            stringB,
            "ar",
            {
              numeric: true,
              sensitivity: "base"
            }
          )
        : stringB.localeCompare(
            stringA,
            "ar",
            {
              numeric: true,
              sensitivity: "base"
            }
          );
    });
  }, [
    filteredItems,
    sortField,
    sortOrder
  ]);

  /*
   * =========================================================
   * PAGINATION
   * =========================================================
   */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedItems.length /
          pageSize
      )
    );

  /*
   * Safety:
   * if filtering makes current page invalid,
   * return to first page.
   */
  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages
  ]);

  const paginatedItems =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        pageSize;

      return sortedItems.slice(
        start,
        start + pageSize
      );
    }, [
      sortedItems,
      currentPage,
      pageSize
    ]);

  /*
   * =========================================================
   * CATEGORIES
   * =========================================================
   */

  const categories =
    useMemo(() => {
      const set =
        new Set<string>();

      items.forEach(item => {
        const category =
          cleanStr(
            item.category
          );

        if (category) {
          set.add(category);
        }
      });

      ingredients.forEach(item => {
        const category =
          cleanStr(
            item.category
          );

        if (category) {
          set.add(category);
        }
      });

      return Array.from(set).sort(
        (a, b) =>
          a.localeCompare(
            b,
            "ar"
          )
      );
    }, [
      items,
      ingredients,
      cleanStr
    ]);

  /*
   * =========================================================
   * BRANDS
   * =========================================================
   */

  const brands =
    useMemo(() => {
      const set =
        new Set<string>();

      items.forEach(item => {
        const brand =
          cleanStr(
            item.brand
          );

        if (brand) {
          set.add(brand);
        }
      });

      return Array.from(set).sort(
        (a, b) =>
          a.localeCompare(
            b,
            "ar"
          )
      );
    }, [
      items,
      cleanStr
    ]);

  /*
   * =========================================================
   * STATUS BADGE
   * =========================================================
   */

  const renderStatusBadge =
    useCallback(
      (
        status: string,
        label?: string
      ) => {
        switch (status) {
          case "out_of_stock":
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-[11px] border border-red-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {label || "نافد (0)"}
              </span>
            );

          case "low_stock":
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                {label || "منخفض"}
              </span>
            );

          case "overstock":
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-50 text-orange-800 font-semibold text-[11px] border border-orange-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
                {label || "زائد"}
              </span>
            );

          case "fully_reserved":
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-semibold text-[11px] border border-purple-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                {label || "محجوز بالكامل"}
              </span>
            );

          case "in_transit":
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                {label || "قيد النقل"}
              </span>
            );

          default:
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold text-[11px] border border-emerald-200/80 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {label || "طبيعي"}
              </span>
            );
        }
      },
      []
    );

  /*
   * =========================================================
   * SORT HANDLER
   * =========================================================
   */

  const handleSort =
    useCallback(
      (field: string) => {
        setCurrentPage(1);

        if (
          sortField === field
        ) {
          setSortOrder(
            previous =>
              previous ===
              "asc"
                ? "desc"
                : "asc"
          );
        } else {
          setSortField(field);
          setSortOrder("asc");
        }
      },
      [sortField]
    );

  /*
   * =========================================================
   * EXPORT
   * =========================================================
   */

  const exportToExcelComprehensive =
    useCallback(() => {
      try {
        if (
          !sortedItems.length
        ) {
          onNotify?.(
            "لا توجد بيانات لتصديرها",
            "info"
          );
          return;
        }

        const exportData =
          sortedItems.map(
            item => ({
              "اسم الصنف":
                item.ingredient_name ||
                item.name ||
                "",

              "كود الصنف":
                cleanCode(
                  item.ingredient_code ||
                    item.item_code ||
                    item.code,
                  item.ingredient_id ||
                    item.id
                ),

              "الباركود":
                cleanStr(
                  item.barcode
                ) || "",

              "التصنيف":
                cleanStr(
                  item.category
                ) || "",

              "الماركة":
                cleanStr(
                  item.brand
                ) || "",

              "المخزن":
                item.warehouse_name ||
                "",

              "موقع التخزين":
                item.location_formatted ||
                item.location_code ||
                "عام",

              "الوحدة الأساسية":
                item.ingredient_unit ||
                item.unit ||
                "قطعة",

              "الرصيد الإجمالي":
                Number(
                  item.quantity || 0
                ),

              "المتاح للصرف":
                Number(
                  item.available || 0
                ),

              "المحجوز":
                Number(
                  item.reserved || 0
                ),

              "قيد النقل":
                Number(
                  item.in_transit || 0
                ),

              "الحد الأدنى":
                Number(
                  item.min_stock || 0
                ),

              "نقطة إعادة الطلب":
                Number(
                  item.reorder_point || 0
                ),

              "الحد الأقصى":
                Number(
                  item.max_stock || 0
                ),

              "متوسط التكلفة":
                Number(
                  item.avg_cost || 0
                ),

              "آخر سعر شراء":
                Number(
                  item.last_purchase_price ||
                    0
                ),

              "إجمالي القيمة":
                Number(
                  item.inventory_value ??
                    Number(
                      item.quantity || 0
                    ) *
                      Number(
                        item.avg_cost ||
                          0
                      )
                ),

              "حالة المخزون":
                item.statusLabel ||
                item.status ||
                "طبيعي",

              "أيام التغطية":
                item.days_of_supply !==
                999
                  ? item.days_of_supply
                  : "غير محدد",

              "معدل الاستهلاك اليومي":
                Number(
                  item.daily_avg_consumption ||
                    0
                ),

              "الكمية المقترحة للشراء":
                Number(
                  item.suggested_order_qty ||
                    0
                ),

              "تاريخ آخر حركة":
                item.last_movement?.date
                  ? new Date(
                      item.last_movement.date
                    ).toLocaleDateString(
                      "ar-EG-u-nu-latn"
                    )
                  : "—",

              "نوع آخر حركة":
                item.last_movement
                  ?.ref_type || "—",

              "كمية آخر حركة":
                item.last_movement
                  ?.delta ?? "—"
            })
          );

        const headers =
          Object.keys(
            exportData[0] || {}
          );

        const csvRows = [
          headers.join(","),
          ...exportData.map(
            row =>
              headers
                .map(
                  header =>
                    `"${String(
                      (row as any)[
                        header
                      ] ?? ""
                    ).replace(
                      /"/g,
                      '""'
                    )}"`
                )
                .join(",")
          )
        ];

        const blob =
          new Blob(
            [
              "\uFEFF" +
                csvRows.join(
                  "\n"
                )
            ],
            {
              type:
                "text/csv;charset=utf-8;"
            }
          );

        const url =
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            "a"
          );

        link.href = url;

        link.download =
          `enterprise_stock_balance_${new Date()
            .toISOString()
            .split("T")[0]}.csv`;

        document.body.appendChild(
          link
        );

        link.click();

        document.body.removeChild(
          link
        );

        URL.revokeObjectURL(
          url
        );

        onNotify?.(
          "تم تصدير تقرير الأرصدة الشامل بنجاح",
          "success"
        );
      } catch (error) {
        console.error(
          "Stock export error:",
          error
        );

        onNotify?.(
          "فشل تصدير البيانات",
          "error"
        );
      }
    }, [
      sortedItems,
      cleanCode,
      cleanStr,
      onNotify
    ]);

  /*
   * =========================================================
   * DRAWER
   * =========================================================
   */

  const handleOpenDrawer =
    useCallback(
      (ingredientId: any) => {
        if (
          ingredientId ===
            null ||
          ingredientId ===
            undefined
        ) {
          return;
        }

        setSelectedDrawerItemId(
          Number(ingredientId)
        );

        setIsDrawerOpen(true);
      },
      []
    );

  /*
   * =========================================================
   * ACTIVE FILTER CHECK
   * =========================================================
   */

  const hasActiveFilters =
    Boolean(
      searchQuery ||
        selectedWarehouse !==
          "all" ||
        selectedStockStatus !==
          "all" ||
        selectedCategory !==
          "all" ||
        selectedBrand !==
          "all" ||
        selectedItemType !==
          "all" ||
        filterHasBatch ||
        filterHasSerial ||
        filterMinQty ||
        filterMaxQty
    );

  /*
   * =========================================================
   * RESET FILTERS
   * =========================================================
   */

  const resetFilters =
    useCallback(() => {
      setSearchQuery("");
      setSelectedWarehouse(
        "all"
      );
      setSelectedStockStatus(
        "all"
      );
      setSelectedCategory(
        "all"
      );
      setSelectedBrand("all");
      setSelectedItemType(
        "all"
      );
      setFilterHasBatch(false);
      setFilterHasSerial(false);
      setFilterMinQty("");
      setFilterMaxQty("");
      setCurrentPage(1);
    }, []);

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div
      className="space-y-3 text-right"
      dir="rtl"
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white px-4 py-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Box className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                أرصدة الأصناف والرقابة المخزنية
              </h1>

              <span className="text-[11px] text-slate-400">
                ·
              </span>

              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {sortedItems.length} سجل
              </span>

              {refreshing && (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  جاري التحديث
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Enterprise Stock Balances & Real-Time Inventory Intelligence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              setShowColumnManager(
                !showColumnManager
              )
            }
            className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold border border-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            الأعمدة
          </button>

          <button
            onClick={() =>
              setShowAdvancedFilters(
                !showAdvancedFilters
              )
            }
            className={`h-8 px-3 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showAdvancedFilters ||
              selectedStockStatus !==
                "all" ||
              selectedCategory !==
                "all"
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            فلاتر متقدمة
          </button>

          <button
            onClick={
              exportToExcelComprehensive
            }
            className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير Excel شامل
          </button>

          <button
            onClick={() =>
              fetchData({
                silent: true,
                notify: true
              })
            }
            disabled={refreshing}
            title="تحديث البيانات"
            className="h-8 w-8 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 rounded-md border border-slate-300 flex items-center justify-center transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                refreshing
                  ? "animate-spin text-blue-600"
                  : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* =====================================================
          KPI STRIP
      ====================================================== */}

      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {/* Total Value */}
        <div className="bg-white rounded-lg px-3 py-2.5 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-500 truncate">
              إجمالي قيمة المخزون
            </span>

            <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>

          <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-1 truncate">
            {fmtMoney(
              kpis.total_value ||
                0
            )}
          </p>

          <span className="text-[10px] text-slate-400 truncate">
            وفق متوسط التكلفة
          </span>
        </div>

        {/* Total Items */}
        <div
          onClick={() =>
            setSelectedStockStatus(
              "all"
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            selectedStockStatus ===
            "all"
              ? "bg-slate-50/80 border-slate-300"
              : "bg-white hover:bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-600 truncate">
              إجمالي الأصناف
            </span>

            <Box className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-blue-700 font-mono tabular-nums mt-1">
            {kpis.total_items ||
              items.length}
          </p>

          <span className="text-[10px] text-slate-500 font-mono tabular-nums truncate">
            الكمية:{" "}
            {fmt(
              kpis.total_quantity ||
                0
            )}
          </span>
        </div>

        {/* Low Stock */}
        <div
          onClick={() =>
            setSelectedStockStatus(
              selectedStockStatus ===
                "low_stock"
                ? "all"
                : "low_stock"
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            selectedStockStatus ===
            "low_stock"
              ? "bg-amber-50 border-amber-400"
              : "bg-white hover:bg-amber-50/40 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-amber-800 truncate">
              أصناف منخفضة
            </span>

            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-amber-700 font-mono tabular-nums mt-1">
            {kpis.low_stock_count ||
              0}
          </p>

          <span className="text-[10px] text-amber-700/80 truncate">
            دون نقطة الطلب
          </span>
        </div>

        {/* Out Of Stock */}
        <div
          onClick={() =>
            setSelectedStockStatus(
              selectedStockStatus ===
                "out_of_stock"
                ? "all"
                : "out_of_stock"
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            selectedStockStatus ===
            "out_of_stock"
              ? "bg-red-50 border-red-400"
              : "bg-white hover:bg-red-50/40 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-red-800 truncate">
              أصناف نافدة
            </span>

            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-red-700 font-mono tabular-nums mt-1">
            {kpis.out_of_stock_count ||
              0}
          </p>

          <span className="text-[10px] text-red-700/80 truncate">
            رصيد 0 أو سالب
          </span>
        </div>

        {/* Overstock */}
        <div
          onClick={() =>
            setSelectedStockStatus(
              selectedStockStatus ===
                "overstock"
                ? "all"
                : "overstock"
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            selectedStockStatus ===
            "overstock"
              ? "bg-orange-50 border-orange-400"
              : "bg-white hover:bg-orange-50/40 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-orange-800 truncate">
              مخزون زائد
            </span>

            <Layers className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-orange-700 font-mono tabular-nums mt-1">
            {kpis.overstock_count ||
              0}
          </p>

          <span className="text-[10px] text-orange-700/80 truncate">
            فوق الحد الأقصى
          </span>
        </div>

        {/* Fully Reserved */}
        <div
          onClick={() =>
            setSelectedStockStatus(
              selectedStockStatus ===
                "fully_reserved"
                ? "all"
                : "fully_reserved"
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            selectedStockStatus ===
            "fully_reserved"
              ? "bg-purple-50 border-purple-400"
              : "bg-white hover:bg-purple-50/40 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-purple-800 truncate">
              محجوز بالكامل
            </span>

            <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-purple-700 font-mono tabular-nums mt-1">
            {kpis.fully_reserved_count ||
              0}
          </p>

          <span className="text-[10px] text-purple-700/80 font-mono tabular-nums truncate">
            المحجوز:{" "}
            {fmt(
              kpis.total_reserved ||
                0
            )}
          </span>
        </div>

        {/* In Transit */}
        <div
          onClick={() =>
            setSelectedStockStatus(
              selectedStockStatus ===
                "in_transit"
                ? "all"
                : "in_transit"
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            selectedStockStatus ===
            "in_transit"
              ? "bg-blue-50 border-blue-400"
              : "bg-white hover:bg-blue-50/40 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-blue-800 truncate">
              قيد النقل
            </span>

            <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-blue-700 font-mono tabular-nums mt-1">
            {fmt(
              kpis.total_in_transit ||
                0
            )}
          </p>

          <span className="text-[10px] text-blue-700/80 truncate">
            تحويلات جارية
          </span>
        </div>

        {/* Expiring */}
        <div
          onClick={() =>
            setFilterHasBatch(
              !filterHasBatch
            )
          }
          className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between cursor-pointer transition-colors ${
            filterHasBatch
              ? "bg-amber-50 border-amber-400"
              : "bg-white hover:bg-amber-50/40 border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-amber-800 truncate">
              قرب انتهاء الصلاحية
            </span>

            <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-amber-700 font-mono tabular-nums mt-1">
            {kpis.expiring_count ||
              0}
          </p>

          <span className="text-[10px] text-amber-700/80 truncate">
            خلال 30 يوماً
          </span>
        </div>

        {/* Expired */}
        <div className="bg-white hover:bg-red-50/40 rounded-lg px-3 py-2.5 border border-slate-200 flex flex-col justify-between cursor-pointer transition-colors">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-red-800 truncate">
              منتهي الصلاحية
            </span>

            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          </div>

          <p className="text-sm font-bold text-red-700 font-mono tabular-nums mt-1">
            {kpis.expired_count ||
              0}
          </p>

          <span className="text-[10px] text-red-700/80 truncate">
            يتطلب إتلاف أو إرجاع
          </span>
        </div>

        {/* Slow Moving */}
        <div className="bg-white hover:bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200 flex flex-col justify-between cursor-pointer transition-colors">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-semibold text-slate-600 truncate">
              أصناف راكدة
            </span>

            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>

          <p className="text-sm font-bold text-slate-800 font-mono tabular-nums mt-1">
            {kpis.slow_moving_count ||
              0}
          </p>

          <span className="text-[10px] text-slate-400 truncate">
            دون حركة صرف 30 يوم
          </span>
        </div>
      </div>

      {/* =====================================================
          FILTER TOOLBAR
      ====================================================== */}

      <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />

            <input
              type="text"
              placeholder="بحث باسم الصنف، الكود، الباركود، SKU، أو اسم المخزن..."
              value={searchQuery}
              onChange={e =>
                setSearchQuery(
                  e.target.value
                )
              }
              className="w-full h-8 bg-slate-50/70 focus:bg-white border border-slate-300 rounded-md pr-8 pl-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 transition-colors"
            />

            {searchQuery && (
              <button
                onClick={() =>
                  setSearchQuery("")
                }
                className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Warehouse */}
          <select
            value={
              selectedWarehouse
            }
            onChange={e =>
              setSelectedWarehouse(
                e.target.value
              )
            }
            className={`h-8 lg:w-52 border rounded-md px-2.5 text-xs font-semibold focus:outline-none focus:border-blue-600 transition-colors ${
              selectedWarehouse !==
              "all"
                ? "bg-blue-50/60 border-blue-300 text-blue-900"
                : "bg-slate-50/70 border-slate-300 text-slate-700"
            }`}
          >
            <option value="all">
              كل المخازن والفروع
            </option>

            {warehouses.map(
              (warehouse, index) => (
                <option
                  key={`wh-stock-${warehouse.id ?? index}-${index}`}
                  value={
                    warehouse.id
                  }
                >
                  {warehouse.name}{" "}
                  {warehouse.code
                    ? `(${warehouse.code})`
                    : ""}
                </option>
              )
            )}
          </select>

          {/* Status */}
          <select
            value={
              selectedStockStatus
            }
            onChange={e =>
              setSelectedStockStatus(
                e.target.value
              )
            }
            className={`h-8 lg:w-48 border rounded-md px-2.5 text-xs font-semibold focus:outline-none focus:border-blue-600 transition-colors ${
              selectedStockStatus !==
              "all"
                ? "bg-blue-50/60 border-blue-300 text-blue-900"
                : "bg-slate-50/70 border-slate-300 text-slate-700"
            }`}
          >
            <option value="all">
              كل حالات المخزون
            </option>

            <option value="optimal">
              طبيعي
            </option>

            <option value="low_stock">
              منخفض (تحت الطلب)
            </option>

            <option value="out_of_stock">
              نافد (0)
            </option>

            <option value="overstock">
              زائد (فوق الحد)
            </option>

            <option value="fully_reserved">
              محجوز بالكامل
            </option>

            <option value="in_transit">
              قيد النقل
            </option>
          </select>

          {/* Advanced */}
          <button
            onClick={() =>
              setShowAdvancedFilters(
                !showAdvancedFilters
              )
            }
            className={`h-8 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors whitespace-nowrap ${
              showAdvancedFilters ||
              selectedCategory !==
                "all" ||
              selectedBrand !==
                "all" ||
              selectedItemType !==
                "all" ||
              filterHasBatch ||
              filterHasSerial ||
              filterMinQty ||
              filterMaxQty
                ? "bg-blue-50 border-blue-300 text-blue-800"
                : "bg-white hover:bg-slate-50 border-slate-300 text-slate-700"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-blue-600" />

            <span>
              فلاتر متقدمة
            </span>

            {(selectedCategory !==
              "all" ||
              selectedBrand !==
                "all" ||
              selectedItemType !==
                "all" ||
              filterHasBatch ||
              filterHasSerial ||
              filterMinQty ||
              filterMaxQty) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            )}
          </button>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={
                resetFilters
              }
              title="إعادة ضبط الفلاتر"
              className="h-8 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة ضبط
            </button>
          )}

          {/* Save */}
          <button
            onClick={() =>
              setShowSaveFilterModal(
                true
              )
            }
            title="حفظ الفلتر الحالي كنموذج جاهز"
            className="h-8 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            حفظ الفلتر
          </button>
        </div>

        {/* Saved Filters */}
        {savedFilters.length >
          0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              الفلاتر المحفوظة:
            </span>

            {savedFilters.map(
              (
                savedFilter,
                index
              ) => (
                <div
                  key={`${savedFilter.name}-${index}`}
                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded px-2 py-0.5 text-[11px] font-medium text-slate-700 whitespace-nowrap"
                >
                  <button
                    onClick={() =>
                      applySavedFilter(
                        savedFilter
                      )
                    }
                    className="hover:text-blue-600 transition-colors"
                  >
                    {
                      savedFilter.name
                    }
                  </button>

                  <button
                    onClick={() =>
                      removeSavedFilter(
                        index
                      )
                    }
                    className="text-slate-400 hover:text-red-600 mr-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-600 font-semibold block mb-1 text-[11px]">
                التصنيف
              </label>

              <select
                value={
                  selectedCategory
                }
                onChange={e =>
                  setSelectedCategory(
                    e.target.value
                  )
                }
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value="all">
                  كل التصنيفات
                </option>

                {categories.map(
                  (
                    category,
                    index
                  ) => (
                    <option
                      key={`stock-cat-${category}-${index}`}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1 text-[11px]">
                الماركة / Brand
              </label>

              <select
                value={
                  selectedBrand
                }
                onChange={e =>
                  setSelectedBrand(
                    e.target.value
                  )
                }
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value="all">
                  كل الماركات
                </option>

                {brands.map(
                  (
                    brand,
                    index
                  ) => (
                    <option
                      key={`stock-brand-${brand}-${index}`}
                      value={brand}
                    >
                      {brand}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1 text-[11px]">
                نوع الصنف (Item Type)
              </label>

              <select
                value={
                  selectedItemType
                }
                onChange={e =>
                  setSelectedItemType(
                    e.target.value
                  )
                }
                className="w-full h-8 bg-slate-50 border border-slate-300 rounded-md px-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value="all">
                  كل الأنواع
                </option>

                <option value="raw_material">
                  مادة خام (Raw Material)
                </option>

                <option value="finished_good">
                  منتج تام (Finished Good)
                </option>

                <option value="consumable">
                  مستهلكات وتشغيل (Consumable)
                </option>

                <option value="spare_part">
                  قطع غيار (Spare Part)
                </option>

                <option value="asset">
                  أصول ومعدات (Asset)
                </option>
              </select>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1 text-[11px]">
                الكمية (من / إلى)
              </label>

              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="من"
                  value={
                    filterMinQty
                  }
                  onChange={e =>
                    setFilterMinQty(
                      e.target.value
                    )
                  }
                  className="w-1/2 h-8 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-mono tabular-nums text-slate-800 focus:outline-none focus:border-blue-600"
                />

                <input
                  type="number"
                  placeholder="إلى"
                  value={
                    filterMaxQty
                  }
                  onChange={e =>
                    setFilterMaxQty(
                      e.target.value
                    )
                  }
                  className="w-1/2 h-8 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-mono tabular-nums text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-5 pt-1 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold text-xs">
                <input
                  type="checkbox"
                  checked={
                    filterHasBatch
                  }
                  onChange={e =>
                    setFilterHasBatch(
                      e.target.checked
                    )
                  }
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0"
                />

                <span>
                  يحتوي على تشغيلات وتواريخ صلاحية
                  (Batches)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold text-xs">
                <input
                  type="checkbox"
                  checked={
                    filterHasSerial
                  }
                  onChange={e =>
                    setFilterHasSerial(
                      e.target.checked
                    )
                  }
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0"
                />

                <span>
                  يحتوي على أرقام تسلسلية
                  (Serials)
                </span>
              </label>

              <button
                onClick={
                  resetFilters
                }
                className="text-red-600 hover:text-red-700 font-semibold mr-auto text-xs"
              >
                إعادة ضبط كل الفلاتر
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          DATA GRID
      ====================================================== */}

      <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-slate-700">
              <tr className="divide-x divide-x-reverse divide-slate-200/80">
                {visibleColumns.item && (
                  <th
                    onClick={() =>
                      handleSort(
                        "ingredient_name"
                      )
                    }
                    className="px-3 py-2.5 font-bold text-[11px] text-slate-700 cursor-pointer hover:bg-slate-200/60 select-none whitespace-nowrap text-right"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        الصنف والكود
                      </span>

                      <span className="text-[10px] text-blue-600">
                        {sortField ===
                        "ingredient_name"
                          ? sortOrder ===
                            "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumns.warehouse && (
                  <th
                    onClick={() =>
                      handleSort(
                        "warehouse_name"
                      )
                    }
                    className="px-3 py-2.5 font-bold text-[11px] text-slate-700 cursor-pointer hover:bg-slate-200/60 select-none whitespace-nowrap text-right"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        المخزن
                      </span>

                      <span className="text-[10px] text-blue-600">
                        {sortField ===
                        "warehouse_name"
                          ? sortOrder ===
                            "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumns.status && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-center whitespace-nowrap">
                    حالة المخزون
                  </th>
                )}

                {visibleColumns.location && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-center whitespace-nowrap">
                    مكان التخزين
                  </th>
                )}

                {visibleColumns.quantity && (
                  <th
                    onClick={() =>
                      handleSort(
                        "quantity"
                      )
                    }
                    className="px-3 py-2.5 font-bold text-[11px] text-slate-700 cursor-pointer hover:bg-slate-200/60 select-none whitespace-nowrap text-right"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        الكمية الحالية
                      </span>

                      <span className="text-[10px] text-blue-600">
                        {sortField ===
                        "quantity"
                          ? sortOrder ===
                            "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumns.units_breakdown && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-center whitespace-nowrap">
                    تعدد الوحدات
                  </th>
                )}

                {visibleColumns.available && (
                  <th className="px-3 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    المتاح للصرف
                  </th>
                )}

                {visibleColumns.reserved && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    المحجوز
                  </th>
                )}

                {visibleColumns.in_transit && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    قيد النقل
                  </th>
                )}

                {visibleColumns.reorder && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    حد الطلب
                  </th>
                )}

                {visibleColumns.consumption && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    معدل الاستهلاك / التغطية
                  </th>
                )}

                {visibleColumns.avg_cost && (
                  <th className="px-3 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    متوسط التكلفة
                  </th>
                )}

                {visibleColumns.last_price && (
                  <th className="px-3 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    آخر سعر شراء
                  </th>
                )}

                {visibleColumns.value && (
                  <th
                    onClick={() =>
                      handleSort(
                        "inventory_value"
                      )
                    }
                    className="px-3 py-2.5 font-bold text-[11px] text-slate-700 cursor-pointer hover:bg-slate-200/60 select-none whitespace-nowrap text-right"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>
                        قيمة المخزون
                      </span>

                      <span className="text-[10px] text-blue-600">
                        {sortField ===
                        "inventory_value"
                          ? sortOrder ===
                            "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </div>
                  </th>
                )}

                {visibleColumns.last_movement && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    آخر حركة
                  </th>
                )}

                {visibleColumns.last_receipt && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    آخر استلام
                  </th>
                )}

                {visibleColumns.last_issue && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-right whitespace-nowrap">
                    آخر صرف
                  </th>
                )}

                {visibleColumns.batches && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-center whitespace-nowrap">
                    التشغيلات
                  </th>
                )}

                {visibleColumns.serials && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-center whitespace-nowrap">
                    السيريال
                  </th>
                )}

                {visibleColumns.actions && (
                  <th className="px-2.5 py-2.5 font-bold text-[11px] text-slate-700 text-center w-20 whitespace-nowrap">
                    الإجراءات
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/70">
              {loading &&
              !items.length ? (
                <tr>
                  <td
                    colSpan={20}
                    className="py-12 px-4 text-center text-slate-500"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />

                    <p className="text-xs font-semibold">
                      جاري تحميل بيانات الأرصدة والذكاء المخزني...
                    </p>
                  </td>
                </tr>
              ) : paginatedItems.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={20}
                    className="py-12 px-4 text-center text-slate-400"
                  >
                    <Box className="w-8 h-8 mx-auto mb-2 text-slate-300" />

                    <p className="text-xs font-bold text-slate-700">
                      لا توجد أصناف تطابق الفلاتر المحددة
                    </p>

                    <p className="text-[11px] text-slate-400 mt-0.5">
                      جرب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(
                  (
                    item,
                    index
                  ) => {
                    const qty =
                      Number(
                        item.quantity ||
                          0
                      );

                    const reserved =
                      Number(
                        item.reserved ||
                          0
                      );

                    const inTransit =
                      Number(
                        item.in_transit ||
                          0
                      );

                    const available =
                      Number(
                        item.available ??
                          Math.max(
                            qty -
                              reserved,
                            0
                          )
                      );

                    const avgCost =
                      Number(
                        item.avg_cost ??
                          item.cost ??
                          0
                      );

                    const value =
                      Number(
                        item.inventory_value ??
                          qty *
                            avgCost
                      );

                    const itemId =
                      item.ingredient_id ||
                      item.id;

                    const rowId =
                      item.item_id ||
                      item.id;

                    const isRowSelected =
                      selectedDrawerItemId ===
                        itemId ||
                      openMenuRowId ===
                        rowId;

                    return (
                      <tr
                        key={
                          rowId ||
                          `stock-row-${index}`
                        }
                        className={`divide-x divide-x-reverse divide-slate-100 transition-colors group ${
                          isRowSelected
                            ? "bg-blue-50/70"
                            : index %
                                  2 ===
                                1
                            ? "bg-slate-50/40 hover:bg-blue-50/40"
                            : "bg-white hover:bg-blue-50/40"
                        }`}
                      >
                        {/* Item */}
                        {visibleColumns.item && (
                          <td className="px-3 py-2 align-middle">
                            <div className="min-w-0">
                              <button
                                onClick={() =>
                                  handleOpenDrawer(
                                    itemId
                                  )
                                }
                                className="font-bold text-slate-900 hover:text-blue-600 text-right text-xs transition-colors truncate block"
                              >
                                {item.ingredient_name ||
                                  item.name ||
                                  "—"}
                              </button>

                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                {cleanCode(
                                  item.ingredient_code ||
                                    item.item_code ||
                                    item.code,
                                  itemId
                                ) && (
                                  <span
                                    dir="ltr"
                                    className="font-mono tabular-nums text-slate-600 font-semibold"
                                  >
                                    {cleanCode(
                                      item.ingredient_code ||
                                        item.item_code ||
                                        item.code,
                                      itemId
                                    )}
                                  </span>
                                )}

                                {cleanStr(
                                  item.category
                                ) && (
                                  <>
                                    <span>
                                      ·
                                    </span>

                                    <span>
                                      {cleanStr(
                                        item.category
                                      )}
                                    </span>
                                  </>
                                )}

                                {cleanStr(
                                  item.barcode
                                ) && (
                                  <>
                                    <span>
                                      ·
                                    </span>

                                    <span
                                      dir="ltr"
                                      className="text-slate-400 font-mono tabular-nums"
                                    >
                                      {cleanStr(
                                        item.barcode
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Warehouse */}
                        {visibleColumns.warehouse && (
                          <td className="px-3 py-2 align-middle whitespace-nowrap">
                            <span className="font-semibold text-slate-800">
                              {item.warehouse_name ||
                                "—"}
                            </span>

                            {item.warehouse_code && (
                              <span
                                dir="ltr"
                                className="text-[10px] text-slate-400 block font-mono tabular-nums"
                              >
                                {
                                  item.warehouse_code
                                }
                              </span>
                            )}
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <td className="px-2.5 py-2 text-center align-middle whitespace-nowrap">
                            {renderStatusBadge(
                              item.status,
                              item.statusLabel
                            )}
                          </td>
                        )}

                        {/* Location */}
                        {visibleColumns.location && (
                          <td className="px-2.5 py-2 text-center align-middle whitespace-nowrap">
                            {item.location_code ? (
                              <span
                                dir="ltr"
                                className="inline-flex items-center gap-1 text-slate-700 font-mono tabular-nums text-[11px] font-semibold"
                              >
                                <MapPin className="w-3 h-3 text-slate-400" />

                                {
                                  item.location_code
                                }
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                —
                              </span>
                            )}
                          </td>
                        )}

                        {/* Quantity */}
                        {visibleColumns.quantity && (
                          <td className="px-3 py-2 text-right align-middle whitespace-nowrap font-mono tabular-nums">
                            <span className="font-bold text-slate-900 text-xs">
                              {fmt(qty)}
                            </span>

                            <span className="text-[10px] font-sans font-normal text-slate-500 mr-1">
                              {item.ingredient_unit ||
                                item.unit ||
                                "وحدة"}
                            </span>
                          </td>
                        )}

                        {/* UOM */}
                        {visibleColumns.units_breakdown && (
                          <td className="px-2.5 py-2 text-center align-middle text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                            {item.secondary_unit_text ||
                              "—"}
                          </td>
                        )}

                        {/* Available */}
                        {visibleColumns.available && (
                          <td className="px-3 py-2 text-right align-middle whitespace-nowrap font-mono tabular-nums">
                            <span className="font-bold text-emerald-700 text-xs">
                              {fmt(
                                available
                              )}
                            </span>
                          </td>
                        )}

                        {/* Reserved */}
                        {visibleColumns.reserved && (
                          <td className="px-2.5 py-2 text-right align-middle whitespace-nowrap font-mono tabular-nums">
                            {reserved >
                            0 ? (
                              <button
                                onClick={() =>
                                  setReservedModalItem(
                                    item
                                  )
                                }
                                className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200 transition-colors"
                              >
                                {fmt(
                                  reserved
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-400">
                                0
                              </span>
                            )}
                          </td>
                        )}

                        {/* In Transit */}
                        {visibleColumns.in_transit && (
                          <td className="px-2.5 py-2 text-right align-middle whitespace-nowrap font-mono tabular-nums">
                            {inTransit >
                            0 ? (
                              <button
                                onClick={() =>
                                  setInTransitModalItem(
                                    item
                                  )
                                }
                                className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200 transition-colors"
                              >
                                {fmt(
                                  inTransit
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-400">
                                0
                              </span>
                            )}
                          </td>
                        )}

                        {/* Reorder */}
                        {visibleColumns.reorder && (
                          <td className="px-2.5 py-2 text-right align-middle whitespace-nowrap font-mono tabular-nums">
                            <div className="text-[11px]">
                              <span className="font-semibold text-slate-700">
                                {fmt(
                                  item.reorder_point ??
                                    item.min_stock ??
                                    0
                                )}
                              </span>

                              {Number(
                                item.max_stock ||
                                  0
                              ) >
                                0 && (
                                <span className="text-slate-400 block text-[10px]">
                                  أقصى:{" "}
                                  {fmt(
                                    item.max_stock
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Consumption */}
                        {visibleColumns.consumption && (
                          <td className="px-2.5 py-2 text-right align-middle text-[11px] whitespace-nowrap font-mono tabular-nums">
                            <span className="font-semibold text-slate-800">
                              {fmt(
                                item.daily_avg_consumption
                              )}{" "}
                              / يوم
                            </span>

                            <span
                              className={`block font-sans text-[10px] ${
                                Number(
                                  item.days_of_supply
                                ) <
                                15
                                  ? "text-red-600 font-semibold"
                                  : "text-slate-500"
                              }`}
                            >
                              {item.days_of_supply !==
                              999
                                ? `تغطية: ${item.days_of_supply} يوم`
                                : "—"}
                            </span>
                          </td>
                        )}

                        {/* Avg Cost */}
                        {visibleColumns.avg_cost && (
                          <td className="px-3 py-2 text-right align-middle font-mono tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                            {fmtMoney(
                              avgCost
                            )}
                          </td>
                        )}

                        {/* Last Price */}
                        {visibleColumns.last_price && (
                          <td className="px-3 py-2 text-right align-middle font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {fmtMoney(
                              item.last_purchase_price ||
                                0
                            )}
                          </td>
                        )}

                        {/* Value */}
                        {visibleColumns.value && (
                          <td className="px-3 py-2 text-right align-middle font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                            {fmtMoney(
                              value
                            )}
                          </td>
                        )}

                        {/* Last Movement */}
                        {visibleColumns.last_movement && (
                          <td className="px-2.5 py-2 text-right align-middle whitespace-nowrap">
                            {item.last_movement?.date ? (
                              <button
                                onClick={() =>
                                  handleOpenDrawer(
                                    itemId
                                  )
                                }
                                className="text-[11px] text-right hover:text-blue-600 transition-colors"
                              >
                                <span className="font-mono tabular-nums text-slate-700 block">
                                  {new Date(
                                    item.last_movement.date
                                  ).toLocaleDateString(
                                    "ar-EG-u-nu-latn"
                                  )}
                                </span>

                                <span
                                  className={`text-[10px] font-semibold font-mono tabular-nums ${
                                    Number(
                                      item
                                        .last_movement
                                        .delta
                                    ) >
                                    0
                                      ? "text-emerald-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {
                                    item
                                      .last_movement
                                      .ref_type
                                  }{" "}
                                  (
                                  {Number(
                                    item
                                      .last_movement
                                      .delta
                                  ) >
                                  0
                                    ? `+${item.last_movement.delta}`
                                    : item
                                        .last_movement
                                        .delta}
                                  )
                                </span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                —
                              </span>
                            )}
                          </td>
                        )}

                        {/* Last Receipt */}
                        {visibleColumns.last_receipt && (
                          <td className="px-2.5 py-2 text-right align-middle text-[11px] whitespace-nowrap font-mono tabular-nums">
                            {item.last_receipt?.date ? (
                              <div>
                                <span className="text-slate-700 block">
                                  {new Date(
                                    item.last_receipt.date
                                  ).toLocaleDateString(
                                    "ar-EG-u-nu-latn"
                                  )}
                                </span>

                                <span className="text-emerald-700 font-semibold">
                                  {fmt(
                                    item
                                      .last_receipt
                                      .quantity
                                  )}{" "}
                                  وحدة
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}

                        {/* Last Issue */}
                        {visibleColumns.last_issue && (
                          <td className="px-2.5 py-2 text-right align-middle text-[11px] whitespace-nowrap font-mono tabular-nums">
                            {item.last_issue?.date ? (
                              <div>
                                <span className="text-slate-700 block">
                                  {new Date(
                                    item.last_issue.date
                                  ).toLocaleDateString(
                                    "ar-EG-u-nu-latn"
                                  )}
                                </span>

                                <span className="text-red-700 font-semibold">
                                  {fmt(
                                    item
                                      .last_issue
                                      .quantity
                                  )}{" "}
                                  وحدة
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}

                        {/* Batches */}
                        {visibleColumns.batches && (
                          <td className="px-2.5 py-2 text-center align-middle whitespace-nowrap">
                            {Number(
                              item.batch_count ||
                                0
                            ) >
                            0 ? (
                              <span className="text-purple-700 font-mono tabular-nums font-semibold text-[11px]">
                                {
                                  item.batch_count
                                }{" "}
                                تشغيلة
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}

                        {/* Serials */}
                        {visibleColumns.serials && (
                          <td className="px-2.5 py-2 text-center align-middle whitespace-nowrap">
                            {Number(
                              item.serial_count ||
                                0
                            ) >
                            0 ? (
                              <span className="text-blue-700 font-mono tabular-nums font-semibold text-[11px]">
                                {
                                  item.serial_count
                                }{" "}
                                سيريال
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}

                        {/* Actions */}
                        {visibleColumns.actions && (
                          <td className="px-2 py-1.5 text-center align-middle relative whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() =>
                                  handleOpenDrawer(
                                    itemId
                                  )
                                }
                                title="عرض تفاصيل الصنف بالكامل"
                                className="p-1 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() =>
                                  setOpenMenuRowId(
                                    openMenuRowId ===
                                      rowId
                                      ? null
                                      : rowId
                                  )
                                }
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {openMenuRowId ===
                              rowId && (
                              <div className="absolute left-2 top-9 z-30 w-48 bg-white rounded-lg shadow-lg border border-slate-200 p-1 text-right space-y-0.5">
                                <button
                                  onClick={() => {
                                    handleOpenDrawer(
                                      itemId
                                    );

                                    setOpenMenuRowId(
                                      null
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  عرض بطاقة الصنف الشاملة
                                </button>

                                <button
                                  onClick={() => {
                                    onNavigateToFeature?.(
                                      "transactions"
                                    );

                                    setOpenMenuRowId(
                                      null
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  حركة استلام / صرف جديدة
                                </button>

                                <button
                                  onClick={() => {
                                    onNavigateToFeature?.(
                                      "transfers"
                                    );

                                    setOpenMenuRowId(
                                      null
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                                  تحويل لمخزن آخر
                                </button>

                                <button
                                  onClick={() => {
                                    onNavigateToFeature?.(
                                      "barcode"
                                    );

                                    setOpenMenuRowId(
                                      null
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5 text-purple-600" />
                                  طباعة ملصق الباركود
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  }
                )
              )}
            </tbody>

            {/* =================================================
                FOOTER TOTALS
            ================================================== */}

            <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-800 text-xs">
              <tr>
                <td
                  colSpan={2}
                  className="px-3 py-2.5"
                >
                  إجمالي الصفحة (
                  {
                    paginatedItems.length
                  }{" "}
                  صنف)
                </td>

                {visibleColumns.quantity && (
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                    {fmt(
                      paginatedItems.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          Number(
                            item.quantity ||
                              0
                          ),
                        0
                      )
                    )}
                  </td>
                )}

                {visibleColumns.available && (
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-emerald-700">
                    {fmt(
                      paginatedItems.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          Number(
                            item.available ||
                              0
                          ),
                        0
                      )
                    )}
                  </td>
                )}

                {visibleColumns.reserved && (
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums font-bold text-amber-700">
                    {fmt(
                      paginatedItems.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          Number(
                            item.reserved ||
                              0
                          ),
                        0
                      )
                    )}
                  </td>
                )}

                {visibleColumns.in_transit && (
                  <td className="px-2.5 py-2.5 text-right font-mono tabular-nums font-bold text-blue-700">
                    {fmt(
                      paginatedItems.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          Number(
                            item.in_transit ||
                              0
                          ),
                        0
                      )
                    )}
                  </td>
                )}

                {visibleColumns.value && (
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                    {fmtMoney(
                      paginatedItems.reduce(
                        (
                          sum,
                          item
                        ) =>
                          sum +
                          Number(
                            item.inventory_value ||
                              Number(
                                item.quantity ||
                                  0
                              ) *
                                Number(
                                  item.avg_cost ||
                                    0
                                )
                          ),
                        0
                      )
                    )}
                  </td>
                )}

                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* =====================================================
            PAGINATION
        ====================================================== */}

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-600 font-medium">
              عرض
            </span>

            <select
              value={pageSize}
              onChange={e => {
                setPageSize(
                  Number(
                    e.target.value
                  )
                );

                setCurrentPage(
                  1
                );
              }}
              className="h-7 bg-white border border-slate-300 rounded px-2 font-mono tabular-nums font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value={10}>
                10
              </option>

              <option value={25}>
                25
              </option>

              <option value={50}>
                50
              </option>

              <option value={100}>
                100
              </option>
            </select>

            <span className="text-slate-400">
              ·
            </span>

            <span className="text-slate-600 font-medium">
              إجمالي النتائج:{" "}
              <strong className="text-slate-900 font-mono tabular-nums">
                {
                  sortedItems.length
                }
              </strong>{" "}
              صنف
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCurrentPage(1)
              }
              disabled={
                currentPage === 1
              }
              className="h-7 px-2.5 rounded bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 font-semibold text-slate-700 transition-colors"
            >
              الأول
            </button>

            <button
              onClick={() =>
                setCurrentPage(
                  page =>
                    Math.max(
                      page - 1,
                      1
                    )
                )
              }
              disabled={
                currentPage === 1
              }
              className="h-7 px-2.5 rounded bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 font-semibold text-slate-700 transition-colors"
            >
              السابق
            </button>

            <span className="h-7 px-3 inline-flex items-center font-mono tabular-nums font-bold text-blue-700 bg-blue-50 rounded border border-blue-200">
              {currentPage} /{" "}
              {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage(
                  page =>
                    Math.min(
                      page + 1,
                      totalPages
                    )
                )
              }
              disabled={
                currentPage ===
                totalPages
              }
              className="h-7 px-2.5 rounded bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 font-semibold text-slate-700 transition-colors"
            >
              التالي
            </button>

            <button
              onClick={() =>
                setCurrentPage(
                  totalPages
                )
              }
              disabled={
                currentPage ===
                totalPages
              }
              className="h-7 px-2.5 rounded bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 font-semibold text-slate-700 transition-colors"
            >
              الأخير
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          COLUMN MANAGER
      ====================================================== */}

      {showColumnManager && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-lg w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />

                <h3 className="text-sm font-bold text-slate-900">
                  تخصيص أعمدة الجدول
                </h3>
              </div>

              <button
                onClick={() =>
                  setShowColumnManager(
                    false
                  )
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              حدد الأعمدة التي ترغب في إظهارها في شاشة أرصدة المخزون، وسيتم حفظ تفضيلاتك آلياً:
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto p-0.5">
              {ALL_COLUMNS.map(
                column => {
                  const checked =
                    !!visibleColumns[
                      column.id
                    ];

                  return (
                    <label
                      key={
                        column.id
                      }
                      className={`flex items-center gap-2 p-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors ${
                        checked
                          ? "bg-blue-50/60 border-blue-300 text-slate-900"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          checked
                        }
                        onChange={e =>
                          saveColumnPreferences(
                            {
                              ...visibleColumns,
                              [column.id]:
                                e.target
                                  .checked
                            }
                          )
                        }
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0"
                      />

                      <span>
                        {
                          column.label
                        }
                      </span>
                    </label>
                  );
                }
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  const reset: Record<
                    string,
                    boolean
                  > = {};

                  ALL_COLUMNS.forEach(
                    column => {
                      reset[
                        column.id
                      ] =
                        column.defaultVisible;
                    }
                  );

                  saveColumnPreferences(
                    reset
                  );
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                استعادة الافتراضي
              </button>

              <button
                onClick={() =>
                  setShowColumnManager(
                    false
                  )
                }
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold transition-colors"
              >
                تم وتطبيق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          SAVE FILTER MODAL
      ====================================================== */}

      {showSaveFilterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full shadow-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                حفظ الفلتر الحالي
              </h3>

              <button
                onClick={() =>
                  setShowSaveFilterModal(
                    false
                  )
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              أدخل اسماً للفلتر لسهولة استخدامه لاحقاً بنقرة زر:
            </p>

            <input
              type="text"
              placeholder="مثال: أصناف الخامات المنخفضة بالمخزن الرئيسي"
              value={newFilterName}
              onChange={e =>
                setNewFilterName(
                  e.target.value
                )
              }
              className="w-full h-8 bg-slate-50 border border-slate-300 rounded-md px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() =>
                  setShowSaveFilterModal(
                    false
                  )
                }
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold"
              >
                إلغاء
              </button>

              <button
                onClick={
                  handleSaveFilter
                }
                disabled={
                  !newFilterName.trim()
                }
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          RESERVED MODAL
      ====================================================== */}

      {reservedModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-lg w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />

                <h3 className="text-sm font-bold text-slate-900">
                  تفاصيل الكميات المحجوزة
                </h3>
              </div>

              <button
                onClick={() =>
                  setReservedModalItem(
                    null
                  )
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="font-bold text-slate-900 text-sm">
                {reservedModalItem.ingredient_name ||
                  reservedModalItem.name ||
                  "—"}
              </p>

              <p className="text-xs text-slate-500 mt-0.5">
                المخزن:{" "}
                <strong className="text-slate-700">
                  {
                    reservedModalItem.warehouse_name
                  }
                </strong>{" "}
                · إجمالي المحجوز:{" "}
                <strong className="text-amber-700 font-mono tabular-nums">
                  {fmt(
                    reservedModalItem.reserved
                  )}{" "}
                  {
                    reservedModalItem.ingredient_unit
                  }
                </strong>
              </p>
            </div>

            <div className="bg-slate-50 rounded-md border border-slate-200 p-3.5 text-xs text-slate-600 space-y-3">
              <p className="leading-relaxed">
                الكميات المحجوزة مقيدة لأوامر مبيعات مؤكدة، أو طلبات صرف أقسام قيد التجهيز، أو أوامر تشغيل مطابخ وصيانة.
              </p>

              <button
                onClick={() => {
                  handleOpenDrawer(
                    reservedModalItem.ingredient_id ||
                      reservedModalItem.id
                  );

                  setReservedModalItem(
                    null
                  );
                }}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                فتح بطاقة الحجوزات الكاملة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          IN TRANSIT MODAL
      ====================================================== */}

      {inTransitModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-lg w-full shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />

                <h3 className="text-sm font-bold text-slate-900">
                  تفاصيل البضاعة قيد النقل
                </h3>
              </div>

              <button
                onClick={() =>
                  setInTransitModalItem(
                    null
                  )
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="font-bold text-slate-900 text-sm">
                {inTransitModalItem.ingredient_name ||
                  inTransitModalItem.name ||
                  "—"}
              </p>

              <p className="text-xs text-slate-500 mt-0.5">
                الكمية قيد النقل:{" "}
                <strong className="text-blue-700 font-mono tabular-nums">
                  {fmt(
                    inTransitModalItem.in_transit
                  )}{" "}
                  {
                    inTransitModalItem.ingredient_unit
                  }
                </strong>
              </p>
            </div>

            <div className="bg-slate-50 rounded-md border border-slate-200 p-3.5 text-xs text-slate-600 space-y-3">
              <p className="leading-relaxed">
                هذه الكميات تم شحنها في مناقلات بين المخازن وهي في طريقها للاستلام الفعلي في المخزن المستهدف.
              </p>

              <button
                onClick={() => {
                  onNavigateToFeature?.(
                    "transfers"
                  );

                  setInTransitModalItem(
                    null
                  );
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                الانتقال لسندات التحويل بين المخازن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          DETAILS DRAWER
      ====================================================== */}

      <StockItemDetailsDrawer
        itemId={
          selectedDrawerItemId
        }
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDrawerItemId(
            null
          );
        }}
        onNotify={onNotify}
        onRefreshParent={() =>
          fetchData({
            silent: true,
            notify: false
          })
        }
      />
    </div>
  );
};