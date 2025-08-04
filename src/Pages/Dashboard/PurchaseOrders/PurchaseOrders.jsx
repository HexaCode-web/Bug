import React, { useEffect, useState, useMemo } from "react";
import DataTable from "react-data-table-component";
import "./PurchaseOrders.css";
import {
  DELETEDOC,
  GETCOLLECTION,
  GETDOC,
  UPDATEDOC,
} from "../../../../server";
import { CreateToast } from "../../../main";
import * as XLSX from "xlsx";
import BulkImportPurchaseOrders from "./BulkImportPurchaseOrders";
import { IoEyeSharp } from "react-icons/io5";
import { MdEdit } from "react-icons/md";
import { MdDeleteOutline } from "react-icons/md";
import secureLocalStorage from "react-secure-storage";

const PurchaseOrders = ({ canEdit }) => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeInnerPage, setActiveInnerPage] = useState("Home");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("standard");

  // Enhanced filter states
  const [filters, setFilters] = useState({
    paymentStatus: "all",
    deliveryStatus: "all",
    clientId: "all",
    dateRange: "all",
    customDateFrom: "",
    customDateTo: "",
    profitRange: "all",
    amountRange: "all",
    customAmountMin: "",
    customAmountMax: "",
    hasGrn: "all",
    searchDate: "purchaseOrderDate",
    hasAttachments: "all",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [invoices, setInvoices] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [targetOrder, setTargetOrder] = useState(null);
  const [initialEditing, setInitialEditing] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showChangeModal, setShowChangeModal] = useState(false);

  const fetchSettings = async () => {
    try {
      setSettings(await GETDOC("settings", "1"));
    } catch (error) {
      console.log(error);

      CreateToast("حدث خطا ما", "e");
    }
  };
  useEffect(() => {
    fetchSettings();
  }, []);
  const formatPaymentDueDate = (dueDateTimestamp) => {
    if (!dueDateTimestamp) return "غير محدد";
    const dueDate = new Date(dueDateTimestamp.seconds * 1000);
    return dueDate.toLocaleDateString("ar-EG");
  };
  const handleRowSelected = (state) => setSelectedRows(state.selectedRows);

  const contextActions = useMemo(() => {
    const handleClear = () => {
      setSelectedRows([]);
      setToggleCleared(!toggleCleared);
    };

    const handleDelete = async () => {
      if (selectedRows.length === 0) {
        CreateToast("لم يتم تحديد أي أوامر توريد للحذف", "w");
        return;
      }

      try {
        for (let order of selectedRows) {
          await DELETEDOC("purchaseOrders", order.ID);
        }
        CreateToast("تم حذف الأوامر المحددة بنجاح", "s");
        setSelectedRows([]);
        setToggleCleared(!toggleCleared);
        fetchOrders();
      } catch (error) {
        console.error(error);
        CreateToast("فشل في حذف الأوامر", "e");
      }
    };

    const handleExport = () => {
      if (selectedRows.length === 0) {
        CreateToast("لم يتم تحديد أي أوامر توريد للتصدير", "w");
        return;
      }

      try {
        const headers = [
          "رقم الأمر",
          "تاريخ الأمر",
          "الشركة",
          "رقم امر توريد العميل",
          "حالة الدفع",
          "حالة التسليم",
          "مبلغ الشراء",
          "مبلغ البيع",
          "الربح",
          "هامش الربح (%)",
          "تصنيف الربح",
          "مدة الدفع (يوم)",
          "تاريخ استحقاق الدفع",
          "فاتورة عرض السعر",
          "تاريخ الفاتورة الإلكترونية",
          "رقم الفاتورة الإلكترونية",
          "رقم إذن التوريد",
          "لديه إذن توريد",
          "عدد المرفقات",
          "الملاحظات",
        ];

        const excelData = selectedRows.map((order) => {
          const paymentStatus = getPaymentStatus(order);
          const deliveryStatus = getDeliveryStatus(order);
          const profit = (order.sellingAmount || 0) - (order.buyingAmount || 0);
          const margin = getProfitMargin(
            order.sellingAmount,
            order.buyingAmount
          );
          const profitBadge = getProfitBadge(margin);
          const client = buyers.find((buyer) => buyer.id === order.buyer);
          const attachmentCount = Object.keys(order.files || {}).length;

          return [
            order.ID || "",
            order.orderDate || "",
            client?.name || "غير محدد",
            order.clientOrderNumber || "غير محدد",
            paymentStatus.text,
            deliveryStatus.text,
            order.buyingAmount || 0,
            order.sellingAmount || 0,
            profit,
            margin.toFixed(1),
            profitBadge.text,
            order.paymentDuration || "",
            formatPaymentDueDate(order.paymentDueDate),
            order.relatedPrice || "",
            order.etktDate || "",
            order.etktNumber || "",
            order.grnNumber || "",
            order.hasGrn ? "نعم" : "لا",
            attachmentCount,
            order.notes || "",
          ];
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);
        XLSX.utils.book_append_sheet(wb, ws, "أوامر التوريد - محددة");

        const filename = `أوامر_التوريد_المحددة_${
          new Date().toISOString().split("T")[0]
        }.xlsx`;

        XLSX.writeFile(wb, filename);
        CreateToast(`تم تصدير ${selectedRows.length} أمر توريد بنجاح`, "s");
      } catch (error) {
        console.error("Export selected error:", error);
        CreateToast("فشل في تصدير الأوامر المحددة", "e");
      }
    };
    const handleExportSimple = () => {
      if (selectedRows.length === 0) {
        CreateToast("لم يتم تحديد أي أوامر توريد للتصدير", "w");
        return;
      }

      try {
        const headers = [
          "رقم امر توريد العميل",
          "اسم الشركة",
          "وصف الطلبية",
          "سعر الشراء بدون الضريبة",
          "سعر البيع بدون الضريبة",
          "رقم الفاتورة الالكترونية",
          "تاريخ اصدار الفاتورة الالكترونية",
          "رقم GRN",
          "تم الدفع",
          "تم التوصيل",
          "مدة الدفع ب اليوم",
          "تاريخ انشاء امر التوريد",
          "ملاحظات",
          "ملاحظات اخري",
        ];
        const excelData = selectedRows.map((order) => {
          const paymentStatus = getPaymentStatus(order);
          const deliveryStatus = getDeliveryStatus(order);

          const client = buyers.find((buyer) => buyer.id === order.buyer);

          return [
            order.clientOrderNumber || "غير محدد",
            client?.name || "غير محدد",
            order.OrderDescription || "",
            order.buyingAmount || 0,
            order.sellingAmount || 0,
            order.etktNumber || "",
            order.etktDate || "",
            order.grnNumber || "",
            paymentStatus.text2,
            deliveryStatus.text2,
            order.paymentDuration || "",
            order.orderDate || "",
            order.notes || "",
            order.notes2 || "",
          ];
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);
        XLSX.utils.book_append_sheet(wb, ws, "أوامر التوريد - محددة");

        const filename = `أوامر_التوريد_المحددة_${
          new Date().toISOString().split("T")[0]
        }.xlsx`;

        XLSX.writeFile(wb, filename);
        CreateToast(`تم تصدير ${selectedRows.length} أمر توريد بنجاح`, "s");
      } catch (error) {
        console.error("Export selected error:", error);
        CreateToast("فشل في تصدير الأوامر المحددة", "e");
      }
    };
    const handleChange = () => {
      setShowChangeModal(true);
    };
    return (
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button onClick={handleExport} className="btn-secondary">
          تصدير مفصل المحدد
        </button>
        <button onClick={handleExportSimple} className="btn-secondary">
          تصدير مبسط المحدد
        </button>
        <button onClick={handleClear} className="Button danger">
          ❌ إلغاء التحديد
        </button>
        {canEdit && (
          <>
            <button
              key="Change"
              onClick={handleChange}
              className="add-item-btn"
            >
              تغيير
            </button>
            <button onClick={handleDelete} className="Button danger">
              🗑️ حذف المحدد ({selectedRows.length})
            </button>
          </>
        )}
      </div>
    );
  }, [selectedRows, toggleCleared]);
  const fetchOrders = async () => {
    setLoading(true);
    try {
      setInvoices(await GETCOLLECTION("Invoices"));
      setBuyers(await GETCOLLECTION("Customers"));
      setSuppliers(await GETCOLLECTION("Suppliers"));
      setPurchaseOrders(await GETCOLLECTION("purchaseOrders"));
    } catch (error) {
      CreateToast(error.message, "e");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [activeInnerPage]);

  const getDaysFromDueDate = (dueDateTimestamp) => {
    if (!dueDateTimestamp) return null;
    const dueDate = new Date(dueDateTimestamp.seconds * 1000);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPaymentStatus = (order) => {
    if (order.isPaid)
      return {
        status: "paid",
        text: "مدفوع",
        className: "status-paid",
        text2: "نعم",
      };

    const daysFromDue = getDaysFromDueDate(order.paymentDueDate);
    if (!order.etktDate) {
      return {
        status: "pending",
        text: "غير مدفوع",
        className: "status-overdue",
        text2: "لا",
      };
    }
    if (daysFromDue === null)
      return {
        status: "unknown",
        text: "غير محدد",
        className: "status-unknown",
        text2: "لا",
      };

    if (daysFromDue < 0)
      return {
        status: "overdue",
        text: `متأخر ${Math.abs(daysFromDue)} يوم`,
        className: "status-overdue",
        text2: "لا",
      };
    if (daysFromDue <= 3)
      return {
        status: "due-soon",
        text: `مستحق خلال ${daysFromDue} يوم`,
        className: "status-due-soon",
        text2: "لا",
      };
    return {
      status: "pending",
      text: `باقي ${daysFromDue} يوم`,
      className: "status-pending",
      text2: "لا",
    };
  };

  const getDeliveryStatus = (order) => {
    if (order.isDelivered)
      return {
        text: "تم التسليم",
        className: "delivery-completed",
        text2: "نعم",
      };
    return {
      text: "لم يتم التسليم",
      className: "delivery-pending",
      text2: "لا",
    };
  };

  // Helper function to get profit margin
  const getProfitMargin = (sellingAmount, buyingAmount) => {
    if (!sellingAmount || !buyingAmount) return 0;
    return ((sellingAmount - buyingAmount) / buyingAmount) * 100;
  };

  // Helper function to get profit badge
  const getProfitBadge = (margin) => {
    if (margin >= 50) return { text: "ممتاز", className: "profit-excellent" };
    if (margin >= 25) return { text: "جيد", className: "profit-good" };
    if (margin > 0) return { text: "منخفض", className: "profit-low" };
    return { text: "خسارة", className: "profit-loss" };
  };

  // Enhanced date filtering function
  const isDateInRange = (orderDate, dateRange, customFrom, customTo) => {
    if (dateRange === "all") return true;

    const orderDateObj = new Date(orderDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (dateRange) {
      case "today":
        return orderDateObj.toDateString() === today.toDateString();
      case "yesterday":
        return orderDateObj.toDateString() === yesterday.toDateString();
      case "last-week":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDateObj >= weekAgo && orderDateObj <= today;
      case "last-month":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orderDateObj >= monthAgo && orderDateObj <= today;
      case "last-3-months":
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return orderDateObj >= threeMonthsAgo && orderDateObj <= today;
      case "custom":
        if (!customFrom || !customTo) return true;
        const fromDate = new Date(customFrom);
        const toDate = new Date(customTo);
        return orderDateObj >= fromDate && orderDateObj <= toDate;
      default:
        return true;
    }
  };

  // Enhanced filtering logic
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      // Search term filter
      const searchMatch =
        searchTerm === "" ||
        order.ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.clientOrderNumber
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        order.etktNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.grnNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        buyers
          .find((cp) => cp.id === order.buyer)
          ?.name?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Payment status filter
      const paymentStatus = getPaymentStatus(order);
      const paymentMatch = (() => {
        if (filters.paymentStatus === "all") return true;
        if (filters.paymentStatus === "paid") return order.isPaid;
        if (filters.paymentStatus === "unpaid") return !order.isPaid;
        return filters.paymentStatus === paymentStatus.status;
      })();

      // Delivery status filter
      const deliveryMatch = (() => {
        if (filters.deliveryStatus === "all") return true;
        if (filters.deliveryStatus === "delivered") return order.isDelivered;
        if (filters.deliveryStatus === "pending") return !order.isDelivered;
        return true;
      })();

      // Client filter
      const clientMatch = (() => {
        if (filters.clientId === "all") return true;
        return order.buyer === filters.clientId;
      })();

      // Date range filter
      const dateMatch = isDateInRange(
        filters.searchDate === "purchaseOrderDate"
          ? order.orderDate
          : order.etktDate,
        filters.dateRange,
        filters.customDateFrom,
        filters.customDateTo
      );

      // Profit range filter
      const profit = (order.sellingAmount || 0) - (order.buyingAmount || 0);
      const margin = getProfitMargin(order.sellingAmount, order.buyingAmount);
      const profitMatch = (() => {
        if (filters.profitRange === "all") return true;
        if (filters.profitRange === "profitable") return profit > 0;
        if (filters.profitRange === "loss") return profit <= 0;
        if (filters.profitRange === "high-margin") return margin >= 25;
        if (filters.profitRange === "low-margin")
          return margin > 0 && margin < 25;
        return true;
      })();

      // Amount range filter
      const totalAmount = order.sellingAmount || 0;
      const amountMatch = (() => {
        if (filters.amountRange === "all") return true;
        if (filters.amountRange === "small") return totalAmount < 10000;
        if (filters.amountRange === "medium")
          return totalAmount >= 10000 && totalAmount < 50000;
        if (filters.amountRange === "large") return totalAmount >= 50000;
        if (filters.amountRange === "custom") {
          const min = parseFloat(filters.customAmountMin) || 0;
          const max = parseFloat(filters.customAmountMax) || Infinity;
          return totalAmount >= min && totalAmount <= max;
        }
        return true;
      })();

      // GRN filter
      const grnMatch = (() => {
        if (filters.hasGrn === "all") return true;
        if (filters.hasGrn === "yes") return order.hasGrn;
        if (filters.hasGrn === "no") return !order.hasGrn;
        return true;
      })();

      // Attachments filter
      const attachmentsMatch = (() => {
        if (filters.hasAttachments === "all") return true;
        const hasFiles = order.files && Object.keys(order.files).length > 0;
        if (filters.hasAttachments === "yes") return hasFiles;
        if (filters.hasAttachments === "no") return !hasFiles;
        return true;
      })();

      return (
        searchMatch &&
        paymentMatch &&
        deliveryMatch &&
        clientMatch &&
        dateMatch &&
        profitMatch &&
        amountMatch &&
        grnMatch &&
        attachmentsMatch
      );
    });
  }, [purchaseOrders, searchTerm, filters, buyers]);

  // Function to update filters
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setFilters({
      paymentStatus: "all",
      deliveryStatus: "all",
      clientId: "all",
      dateRange: "all",
      customDateFrom: "",
      customDateTo: "",
      profitRange: "all",
      amountRange: "all",
      customAmountMin: "",
      customAmountMax: "",
      hasGrn: "all",
      hasAttachments: "all",
    });
    setSearchTerm("");
  };

  // Count active filters
  const activeFiltersCount =
    Object.entries(filters).filter(([key, value]) => {
      if (key.startsWith("custom")) return false; // Don't count custom range inputs
      return value !== "all" && value !== "";
    }).length + (searchTerm ? 1 : 0);
  const exportToExcel = () => {
    try {
      const headers = [
        "رقم الأمر",
        "تاريخ الأمر",
        "الشركة",
        "رقم امر توريد العميل",
        "حالة الدفع",
        "حالة التسليم",
        "مبلغ الشراء",
        "مبلغ البيع",
        "الربح",
        "هامش الربح (%)",
        "تصنيف الربح",
        "مدة الدفع (يوم)",
        "تاريخ استحقاق الدفع",
        "فاتورة عرض السعر",
        "تاريخ الفاتورة الإلكترونية",
        "رقم الفاتورة الإلكترونية",
        "رقم إذن التوريد",
        "لديه إذن توريد",
        "عدد المرفقات",
        "الملاحظات",
      ];

      const excelData = filteredOrders.map((order) => {
        const paymentStatus = getPaymentStatus(order);
        const deliveryStatus = getDeliveryStatus(order);
        const profit = (order.sellingAmount || 0) - (order.buyingAmount || 0);
        const margin = getProfitMargin(order.sellingAmount, order.buyingAmount);
        const profitBadge = getProfitBadge(margin);
        const client = buyers.find((buyer) => buyer.id === order.buyer);
        const attachmentCount = Object.keys(order.files || {}).length;

        return [
          order.ID || "",
          order.orderDate || "",
          client?.name || "غير محدد",
          order.clientOrderNumber || "غير محدد",
          paymentStatus.text,
          deliveryStatus.text,
          order.buyingAmount || 0,
          order.sellingAmount || 0,
          profit,
          margin.toFixed(1),
          profitBadge.text,
          order.paymentDuration || "",
          formatPaymentDueDate(order.paymentDueDate),
          order.relatedPrice || "",
          order.etktDate || "",
          order.etktNumber || "",
          order.grnNumber || "",
          order.hasGrn ? "نعم" : "لا",
          attachmentCount,
          order.notes || "",
        ];
      });

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create summary data
      const summaryData = [
        ["ملخص أوامر التوريد"],
        [`إجمالي الأوامر: ${analytics.totalOrders}`],
        [`إجمالي الشراء: ${analytics.totalBuyingAmount} ج.م`],
        [`إجمالي البيع: ${analytics.totalSellingAmount} ج.م`],
        [`إجمالي الأرباح: ${analytics.totalProfit} ج.م`],
        [""], // Empty row for spacing
      ];

      // Combine summary and headers with data
      const wsData = [...summaryData, headers, ...excelData];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "أوامر التوريد");

      // Generate file and download
      const filename = `أوامر_التوريد_${
        new Date().toISOString().split("T")[0]
      }${activeFiltersCount > 0 ? "_مفلتر" : ""}.xlsx`;
      XLSX.writeFile(wb, filename);

      CreateToast("تم تصدير البيانات إلى Excel بنجاح", "s");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      CreateToast("فشل في تصدير البيانات", "e");
    }
  };
  const exportToExcelSimple = () => {
    try {
      const headers = [
        "رقم امر توريد العميل",
        "اسم الشركة",
        "وصف الطلبية",
        "سعر الشراء بدون الضريبة",
        "سعر البيع بدون الضريبة",
        "رقم الفاتورة الالكترونية",
        "تاريخ اصدار الفاتورة الالكترونية",
        "رقم GRN",
        "تم الدفع",
        "تم التوصيل",
        "مدة الدفع ب اليوم",
        "تاريخ انشاء امر التوريد",
        "ملاحظات",
        "ملاحظات اخري",
      ];

      const excelData = filteredOrders.map((order) => {
        const paymentStatus = getPaymentStatus(order);
        const deliveryStatus = getDeliveryStatus(order);
        const client = buyers.find((buyer) => buyer.id === order.buyer);

        return [
          order.clientOrderNumber || "غير محدد",
          client?.name || "غير محدد",
          order.OrderDescription || "",
          order.buyingAmount || 0,
          order.sellingAmount || 0,
          order.etktNumber || "",
          order.etktDate || "",
          order.grnNumber || "",
          paymentStatus.text2,
          deliveryStatus.text2,
          order.paymentDuration || "",
          order.orderDate || "",
          order.notes || "",
          order.notes2 || "",
        ];
      });

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create summary data

      // Combine summary and headers with data
      const wsData = [headers, ...excelData];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "أوامر التوريد");

      // Generate file and download
      const filename = `أوامر_التوريد_${
        new Date().toISOString().split("T")[0]
      }${activeFiltersCount > 0 ? "_مفلتر" : ""}.xlsx`;
      XLSX.writeFile(wb, filename);

      CreateToast("تم تصدير البيانات إلى Excel بنجاح", "s");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      CreateToast("فشل في تصدير البيانات", "e");
    }
  };
  const standardColumns = [
    {
      name: "تاريخ الأمر",
      selector: (row) => row.orderDate,
      sortable: true,
      cell: (row) => (
        <div className="order-id-cell">
          <span className="order-date">{row.orderDate}</span>
        </div>
      ),
    },
    {
      name: "تاريخ الفاتورة الاكترونية",
      selector: (row) => row.etktDate,
      sortable: true,
      cell: (row) => (
        <div className="order-id-cell">
          <span className="order-date">{row.etktDate}</span>
        </div>
      ),
    },
    {
      name: "رقم الامر عند العميل",
      selector: (row) => row.clientOrderNumber,
      sortable: true,
      cell: (row) => (
        <div className="order-id-cell">
          <span className="order-number">{row.clientOrderNumber}</span>
        </div>
      ),
    },
    {
      name: "وصف الامر",
      selector: (row) => row.OrderDescription,
      sortable: true,
      cell: (row) => (
        <div className="order-id-cell">
          <span className="order-number">{row.OrderDescription}</span>
        </div>
      ),
    },
    {
      name: "العميل",
      selector: (row) => row.buyer,
      sortable: true,
      cell: (row) => (
        <div className="order-id-cell">
          <span className="order-number">
            {buyers.find((cp) => cp.id === row.buyer)?.name || "غير محدد"}
          </span>
        </div>
      ),
    },
    {
      name: "حالة الدفع",
      selector: (row) => {
        const status = getPaymentStatus(row);
        // Assign a priority number for sorting (lower = higher priority)
        switch (status.status) {
          case "paid":
            return 0; // Paid comes first
          case "overdue":
            return 1; // Overdue next
          case "due-soon":
            return 2; // Due soon after
          case "pending":
            return 3; // Pending (normal unpaid) last
          default:
            return 4; // Unknown status
        }
      },
      sortable: true,
      cell: (row) => {
        const status = getPaymentStatus(row);
        return (
          <span className={`payment-status ${status.className}`}>
            {status.text}
          </span>
        );
      },
    },
    {
      name: "حالة التسليم",
      cell: (row) => {
        const delivery = getDeliveryStatus(row);
        return (
          <span className={`delivery-status ${delivery.className}`}>
            {delivery.text}
          </span>
        );
      },
      sortable: true,
    },
    {
      name: "مبلغ الشراء",
      selector: (row) => row.buyingAmount,

      cell: (row) => (
        <span className="amount-cell buying-amount">
          {(row.buyingAmount || 0).toLocaleString()} ج.م
        </span>
      ),
      sortable: true,
      right: true,
    },
    {
      name: "مبلغ البيع",
      selector: (row) => row.sellingAmount,

      cell: (row) => (
        <span className="amount-cell selling-amount">
          {(row.sellingAmount || 0).toLocaleString()} ج.م
        </span>
      ),
      sortable: true,
      right: true,
    },
    {
      name: "هامش الربح",
      selector: (row) => getProfitMargin(row.sellingAmount, row.buyingAmount),

      cell: (row) => {
        const margin = getProfitMargin(row.sellingAmount, row.buyingAmount);
        const badge = getProfitBadge(margin);
        return (
          <span className={`profit-badge ${badge.className}`}>
            {margin.toFixed(1)}% ({badge.text})
          </span>
        );
      },
      sortable: true,
    },
    {
      name: "الإجراءات",
      cell: (row) => (
        <div className="order-actions">
          <div className="buttonIcon" onClick={() => viewOrder(row)}></div>
          {canEdit && (
            <>
              <div className="buttonIcon" onClick={() => deleteOrder(row)}>
                <MdDeleteOutline size={20} />
              </div>
            </>
          )}
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: "150px",
    },
  ];

  const detailedColumns = [
    {
      name: "تواريخ مهمة",
      selector: (row) => row.orderDate,
      sortable: true,
      cell: (row) => (
        <div className="detailed-order-info">
          <div className="detailed-order-id">تاريخ الأمر: {row.orderDate}</div>
          <div className="detailed-order-dates">
            <div>تاريخ الفاتورة الكترونية: {row.etktDate}</div>
            <div>تاريخ الدفع: {formatPaymentDueDate(row.paymentDueDate)}</div>
          </div>
        </div>
      ),
    },
    {
      name: "معلومات الامر",
      selector: (row) => row.etktNumber,
      sortable: true,
      cell: (row) => (
        <div className="detailed-order-info">
          <div className="detailed-order-id">
            رقم الفاتورة الكترونية: {row.etktNumber}
          </div>
          <div className="detailed-order-dates">
            <div>
              العميل:
              {buyers.find((cp) => cp.id === row.buyer)?.name || "غير محدد"}
            </div>
            <div>رقم امر توريد العميل : {row.clientOrderNumber}</div>
            <div>فاتورة عرض السعر : {row.relatedPrice}</div>
          </div>
          <div className="detailed-grn">
            {row.hasGrn && <span>رقم الإذن: {row.grnNumber}</span>}
          </div>
        </div>
      ),
    },
    {
      name: "الحالة والدفع",
      selector: (row) => {
        const status = getPaymentStatus(row);
        // Assign a priority number for sorting (lower = higher priority)
        switch (status.status) {
          case "paid":
            return 0; // Paid comes first
          case "overdue":
            return 1; // Overdue next
          case "due-soon":
            return 2; // Due soon after
          case "pending":
            return 3; // Pending (normal unpaid) last
          default:
            return 4; // Unknown status
        }
      },
      sortable: true,
      cell: (row) => {
        const paymentStatus = getPaymentStatus(row);
        const deliveryStatus = getDeliveryStatus(row);
        return (
          <div className="detailed-status">
            <div
              className={`detailed-payment-status ${paymentStatus.className}`}
            >
              💳 {paymentStatus.text}
            </div>
            <div
              className={`detailed-delivery-status ${deliveryStatus.className}`}
            >
              🚚 {deliveryStatus.text}
            </div>
            <div className="detailed-payment-duration">
              مدة الدفع: {row.paymentDuration} يوم
            </div>
          </div>
        );
      },
    },
    {
      name: "التحليل المالي",
      selector: (row) => (row.sellingAmount || 0) - (row.buyingAmount || 0),
      sortable: true,
      cell: (row) => {
        const profit = (row.sellingAmount || 0) - (row.buyingAmount || 0);
        const margin = getProfitMargin(row.sellingAmount, row.buyingAmount);
        const badge = getProfitBadge(margin);

        return (
          <div className="detailed-financial">
            <div className="detailed-amounts">
              <div>شراء: {(row.buyingAmount || 0).toLocaleString()} ج.م</div>
              <div>
                شراء بعد الضريبة:
                {(
                  (row.buyingAmount * settings.Tax) / 100 + row.buyingAmount ||
                  0
                ).toLocaleString()}
                ج.م
              </div>
              <div>بيع: {(row.sellingAmount || 0).toLocaleString()} ج.م</div>
              <div>
                بيع بعد الضريبة:
                {(
                  (row.sellingAmount * settings.Tax) / 100 +
                    row.sellingAmount || 0
                ).toLocaleString()}
                ج.م
              </div>
            </div>
            <div
              className={`detailed-profit ${
                profit >= 0 ? "profit-positive" : "profit-negative"
              }`}
            >
              ربح: {profit.toLocaleString()} ج.م
            </div>
            <span className={`detailed-profit-badge ${badge.className}`}>
              {margin.toFixed(1)}% ({badge.text})
            </span>
          </div>
        );
      },
    },
    {
      name: "المرفقات",
      selector: (row) =>
        Object.keys(row.files || {}).length +
        Object.keys(row.customDocuments || {}).length,
      sortable: true,
      cell: (row) => {
        const attachmentCount =
          Object.keys(row.files || {}).length +
          Object.keys(row.customDocuments || {}).length;
        return (
          <div className="detailed-attachments">
            <div className="attachment-count">📎 {attachmentCount} مرفق</div>
            <div className="attachment-types">
              {row.files?.orderPdf && (
                <span className="attachment-type">📄 PDF</span>
              )}
              {row.files?.paymentReceipt && (
                <span className="attachment-type">🧾 إيصال</span>
              )}
              {row.files?.grnFile && (
                <span className="attachment-type">📋 إذن</span>
              )}
              {row.files?.etktAttachment && (
                <span className="attachment-type">📋 فاتورة الكترونية</span>
              )}
              {Object.keys(row.customDocuments || {}).length > 0 && (
                <span className="attachment-type">📋 مرفقات اخري</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      name: "التعليفات",
      selector: (row) => row.OrderDescription,
      sortable: true,
      cell: (row) => (
        <div className="detailed-order-info">
          <div className="detailed-order-id">
            وصف الامر: {row.OrderDescription}
          </div>
          <div className="detailed-order-dates">
            <div>ملاحظات : {row.notes}</div>
            <div>ملاحظات اضافة : {row.notes2}</div>
          </div>
        </div>
      ),
    },
    {
      name: "الإجراءات",
      cell: (row) => (
        <div className="order-actions">
          <div className="buttonIcon" onClick={() => viewOrder(row)}>
            <IoEyeSharp size={20} />
          </div>
          {canEdit && (
            <>
              {" "}
              <div className="buttonIcon" onClick={() => editOrder(row)}>
                <MdEdit size={20} />
              </div>
              <div className="buttonIcon" onClick={() => deleteOrder(row)}>
                <MdDeleteOutline size={20} />
              </div>
            </>
          )}
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: "150px",
    },
  ];

  const viewOrder = (order) => {
    setTargetOrder(order);
    setActiveInnerPage("VIEW/EDIT");
    setInitialEditing(false);
  };

  const editOrder = (order) => {
    setTargetOrder(order);
    setActiveInnerPage("VIEW/EDIT");
    setInitialEditing(true);
  };
  const deleteOrder = async (order) => {
    try {
      await DELETEDOC("purchaseOrders", order.ID);
      const updatedOrders = purchaseOrders.filter(
        (oldOrder) => oldOrder.ID !== order.ID
      );
      setPurchaseOrders(updatedOrders);
      CreateToast("تم الحذف", "s");
    } catch (error) {
      console.log(error);
      CreateToast("مشكلة في الحذف", "e");
    }
  };

  // Calculate analytics
  const analytics = {
    totalOrders: filteredOrders.length,
    totalBuyingAmount: filteredOrders.reduce(
      (sum, order) => sum + (order.buyingAmount || 0),
      0
    ),
    totalSellingAmount: filteredOrders.reduce((sum, order) => {
      return sum + (order.sellingAmount || 0);
    }, 0),
    totalProfit: filteredOrders.reduce(
      (sum, order) =>
        sum + ((order.sellingAmount || 0) - (order.buyingAmount || 0)),
      0
    ),
    paidOrders: filteredOrders.filter(
      (order) => getPaymentStatus(order).status === "paid"
    ).length,
    deliveredOrders: filteredOrders.filter((order) => order.isDelivered).length,
    overdueOrders: filteredOrders.filter(
      (order) => getPaymentStatus(order).status === "overdue"
    ).length,
    unknownOrders: filteredOrders.filter(
      (order) => getPaymentStatus(order).status === "unknown"
    ).length,
    dueSoonOrders: filteredOrders.filter(
      (order) => getPaymentStatus(order).status === "due-soon"
    ).length,
    averageMargin:
      filteredOrders.length > 0
        ? filteredOrders.reduce(
            (sum, order) =>
              sum + getProfitMargin(order.sellingAmount, order.buyingAmount),
            0
          ) / filteredOrders.length
        : 0,
  };

  return (
    <div className="PurchaseOrders" dir="rtl">
      {activeInnerPage === "Home" && (
        <>
          <h1>إدارة أوامر التوريد</h1>
          {/* Enhanced Filter Controls */}
          <div className="filter-controls">
            <div className="filter-controls-right">
              {canEdit && (
                <>
                  <button
                    className="add-item-btn"
                    onClick={() => {
                      setActiveInnerPage("import");
                    }}
                  >
                    استيراد
                  </button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading-container">جاري تحميل أوامر التوريد...</div>
          ) : (
            <DataTable
              title={`قائمة أوامر التوريد (${filteredOrders.length})`}
              columns={
                viewMode === "standard" ? standardColumns : detailedColumns
              }
              data={filteredOrders}
              pagination
              theme={
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light"
              }
              responsive
              highlightOnHover
              striped
              paginationPerPage={10}
              paginationRowsPerPageOptions={[
                5, 10, 15, 20, 50, 100, 150, 200, 250,
              ]}
              selectableRows
              contextMessage={{
                singular: "امر توريد",
                plural: "امور توريد",
                message: "محددة",
              }}
              onSelectedRowsChange={handleRowSelected}
              clearSelectedRows={toggleCleared}
              selectableRowsHighlight
              selectableRowsNoSelectAll={false}
              contextActions={contextActions}
              noDataComponent={
                <div className="no-items">
                  لا توجد أوامر توريد تطابق معايير البحث
                </div>
              }
              customStyles={{
                rows: {
                  style: {
                    minHeight: viewMode === "detailed" ? "100px" : "60px",
                  },
                },
              }}
            />
          )}
        </>
      )}

      {activeInnerPage === "import" && (
        <BulkImportPurchaseOrders setActiveInnerPage={setActiveInnerPage} />
      )}
    </div>
  );
};

export default PurchaseOrders;
