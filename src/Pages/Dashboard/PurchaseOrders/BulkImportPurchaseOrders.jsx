import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import DataTable from "react-data-table-component";
import { CreateToast } from "../../../main";
import { SETDOC, QUERY } from "../../../../server";
import "./BulkImportItems.css";

const BulkImportPurchaseOrders = ({ setActiveInnerPage }) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const fileInputRef = useRef(null);

  const generateUUID = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${year}${month}${random}`;
  };

  const generateCounterPartyId = () => {
    const timestamp = Date.now();
    return `Cus-${timestamp}`;
  };

  const findOrCreateCustomer = async (CustomerName) => {
    try {
      const existingCustomers = await QUERY(
        "Customers",
        "name",
        "==",
        CustomerName.trim()
      );

      if (existingCustomers && existingCustomers.length > 0) {
        return existingCustomers[0].id;
      }

      const newCustomerId = generateCounterPartyId();
      const newCustomer = {
        id: newCustomerId,
        name: CustomerName.trim(),
        phones: [""],
        address: "",
        taxId: "",
        department: "",
        departmentPath: [],
        type: "customer",
        notes: "",
      };

      await SETDOC("Customers", newCustomerId, newCustomer, true);
      return newCustomerId;
    } catch (error) {
      console.error("Error finding/creating customer:", error);
      throw error;
    }
  };
  const calculatePaymentDueDate = (etktDate, paymentDuration) => {
    if (!etktDate || !paymentDuration) return null;
    const etktDateDate = new Date(etktDate);
    const dueDate = new Date(etktDateDate);
    dueDate.setDate(dueDate.getDate() + parseInt(paymentDuration));
    return dueDate;
  };
  const generatePurchaseOrderNumber = () => {
    const timestamp = Date.now().toString();
    return `PO-${timestamp.slice(-8)}`;
  };

  const formatDate = (dateInput) => {
    if (!dateInput) return null;

    const parsedDate = parseDate(dateInput);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return null;
    }

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Comprehensive date parsing function
  const parseDate = (dateInput) => {
    if (!dateInput) return null;

    if (dateInput instanceof Date) {
      return dateInput;
    }

    if (typeof dateInput === "number") {
      // Excel date serial number
      if (dateInput > 1 && dateInput < 2958466) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(
          excelEpoch.getTime() + dateInput * 24 * 60 * 60 * 1000
        );
        return date;
      }

      // Unix timestamp in seconds
      if (dateInput > 946684800 && dateInput < 4102444800) {
        return new Date(dateInput * 1000);
      }

      // Unix timestamp in milliseconds
      if (dateInput > 946684800000 && dateInput < 4102444800000) {
        return new Date(dateInput);
      }
    }

    if (typeof dateInput === "string") {
      const trimmed = dateInput.trim();
      if (!trimmed) return null;

      // Try different date formats
      const formats = [
        // DD-MM-YYYY or DD/MM/YYYY
        /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
        // DD-MM-YY or DD/MM/YY
        /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/,
        // YYYY-MM-DD or YYYY/MM/DD
        /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/,
      ];

      // Try DD-MM-YYYY format first
      const ddmmyyyyMatch = trimmed.match(formats[0]);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1]);
        const month = parseInt(ddmmyyyyMatch[2]);
        const year = parseInt(ddmmyyyyMatch[3]);

        // Validate date components
        if (
          day >= 1 &&
          day <= 31 &&
          month >= 1 &&
          month <= 12 &&
          year >= 1900 &&
          year <= 2100
        ) {
          const date = new Date(year, month - 1, day);
          // Double check the date is valid (handles invalid dates like 31/02/2024)
          if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
          ) {
            return date;
          }
        }
      }

      // Try DD-MM-YY format
      const ddmmyyMatch = trimmed.match(formats[1]);
      if (ddmmyyMatch) {
        const day = parseInt(ddmmyyMatch[1]);
        const month = parseInt(ddmmyyMatch[2]);
        let year = parseInt(ddmmyyMatch[3]);

        // Convert 2-digit year to 4-digit (assuming 00-30 = 2000-2030, 31-99 = 1931-1999)
        if (year <= 30) {
          year += 2000;
        } else {
          year += 1900;
        }

        // Validate date components
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          const date = new Date(year, month - 1, day);
          // Double check the date is valid
          if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
          ) {
            return date;
          }
        }
      }

      // Try YYYY-MM-DD format
      const yyyymmddMatch = trimmed.match(formats[2]);
      if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1]);
        const month = parseInt(yyyymmddMatch[2]);
        const day = parseInt(yyyymmddMatch[3]);

        // Validate date components
        if (
          day >= 1 &&
          day <= 31 &&
          month >= 1 &&
          month <= 12 &&
          year >= 1900 &&
          year <= 2100
        ) {
          const date = new Date(year, month - 1, day);
          // Double check the date is valid
          if (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
          ) {
            return date;
          }
        }
      }

      // Fallback to native Date parsing for other formats
      const date = new Date(trimmed);
      if (
        !isNaN(date.getTime()) &&
        date.getFullYear() > 1900 &&
        date.getFullYear() < 2100
      ) {
        return date;
      }
    }

    return null;
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "رقم امر توريد العميل": "CLIENT-001",
        "اسم الشركة": "مثال علي اسم الشركة",
        "وصف الطلبية": "مثال علي وصف الطلبية",
        "سعر الشراء بدون الضريبة": 120.0,
        "سعر البيع بدون الضريبة": 150.0,
        "رقم الفاتورة الالكترونية": "ETKT-12345",
        "تاريخ اصدار الفاتورة الالكترونية": "15-01-2024",
        "رقم GRN": "GRN-001",
        "تم الدفع": "نعم",
        "تم التوصيل": "نعم",
        "مدة الدفع ب اليوم": 30,
        "تاريخ انشاء امر التوريد": "15-01-2024",
        ملاحظات: "ملاحظات إضافية",
        "ملاحظات اخري": "ملاحظات 2",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Order Template");

    // Set column widths
    const colWidths = [
      { wch: 25 }, // رقم امر توريد العميل
      { wch: 25 }, // اسم الشركة
      { wch: 25 }, // سعر الشراء
      { wch: 25 }, // سعر البيع
      { wch: 25 }, // رقم الفاتورة الالكترونية
      { wch: 25 }, // تاريخ اصدار الفاتورة
      { wch: 15 }, // رقم GRN
      { wch: 12 }, // تم الدفع
      { wch: 12 }, // تم التوصيل
      { wch: 20 }, // مدة الدفع
      { wch: 25 }, // تاريخ انشاء امر التوريد
      { wch: 25 }, // ملاحظات
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, "purchase_order_template.xlsx");
    CreateToast("تم تحميل قالب الاستيراد", "s");
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    const fileExtension = uploadedFile.name.split(".").pop().toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(fileExtension)) {
      CreateToast("يرجى اختيار ملف CSV أو Excel", "e");
      return;
    }

    if (uploadedFile.size > 10 * 1024 * 1024) {
      CreateToast("حجم الملف يجب أن يكون أقل من 10 ميجابايت", "e");
      return;
    }

    setFile(uploadedFile);
    parseFile(uploadedFile);
  };

  const parseFile = (file) => {
    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (fileExtension === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          processPreviewData(results.data);
        },
        error: (error) => {
          CreateToast("خطأ في قراءة ملف CSV", "e");
          console.error("CSV parsing error:", error);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            dateNF: "yyyy-mm-dd",
          });
          processPreviewData(jsonData);
        } catch (error) {
          CreateToast("خطأ في قراءة ملف Excel", "e");
          console.error("Excel parsing error:", error);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processPreviewData = (data) => {
    if (!data || data.length === 0) {
      CreateToast("الملف فارغ أو لا يحتوي على بيانات صالحة", "e");
      return;
    }
    const processedData = data.map((row, index) => ({
      ...row,
      ID: generateUUID(),
      relatedPrice: null,
      buyer: row["اسم الشركة"] || "غير محدد",
      clientOrderNumber: row["رقم امر توريد العميل"] || "غير محدد",
      buyingAmount: parseFloat(row["سعر الشراء بدون الضريبة"]) || 0,
      sellingAmount: parseFloat(row["سعر البيع بدون الضريبة"]) || 0,
      isDelivered: row["تم التوصيل"] === "نعم",
      hasGrn: row["رقم GRN"] ? true : false,
      grnNumber: row["رقم GRN"] || "",
      OrderDescription: row["وصف الطلبية"],
      orderDate:
        formatDate(row["تاريخ انشاء امر التوريد"]) || formatDate(new Date()),
      etktDate: formatDate(row["تاريخ اصدار الفاتورة الالكترونية"]) || null,
      etktNumber: row["رقم الفاتورة الالكترونية"] || "غير محدد",
      paymentDuration: parseInt(row["مدة الدفع ب اليوم"]) || null,
      paymentDueDate: calculatePaymentDueDate(
        formatDate(row["تاريخ اصدار الفاتورة الالكترونية"]),
        parseInt(row["مدة الدفع ب اليوم"])
      ),
      isPaid: row["تم الدفع"] === "نعم",
      notes: row["ملاحظات"] || "",
      notes2: row["ملاحظات اخري"] || "",
      files: {},
      createdAt: new Date(),
      items: [],
      updatedAt: new Date(),
    }));

    const limitedData = processedData.slice(0, 100);

    setPreviewData(limitedData);

    const errors = validateImportData(limitedData);
    setValidationErrors(errors);

    if (errors.length === 0) {
      CreateToast(`تم تحميل ${data.length} عنصر بنجاح`, "s");
    } else {
      CreateToast(`تم العثور على ${errors.length} خطأ في البيانات`, "w");
    }
  };

  const validateImportData = (data) => {
    const errors = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2;

      if (!row["اسم الشركة"] || !row["اسم الشركة"].toString().trim()) {
        errors.push(`الصف ${rowNumber}: اسم الشركة مطلوب`);
      }

      if (
        !row["سعر الشراء بدون الضريبة"] ||
        isNaN(parseFloat(row["سعر الشراء بدون الضريبة"])) ||
        parseFloat(row["سعر الشراء بدون الضريبة"]) <= 0
      ) {
        errors.push(`الصف ${rowNumber}: سعر الشراء يجب أن يكون رقماً موجباً`);
      }

      if (
        !row["سعر البيع بدون الضريبة"] ||
        isNaN(parseFloat(row["سعر البيع بدون الضريبة"])) ||
        parseFloat(row["سعر البيع بدون الضريبة"]) <= 0
      ) {
        errors.push(`الصف ${rowNumber}: سعر البيع يجب أن يكون رقماً موجباً`);
      }

      // Enhanced date validation
      if (row["تاريخ اصدار الفاتورة الالكترونية"]) {
        const etktDate = parseDate(row["تاريخ اصدار الفاتورة الالكترونية"]);
        if (!etktDate) {
          errors.push(
            `الصف ${rowNumber}: تاريخ اصدار الفاتورة غير صحيح (استخدم تنسيق DD-MM-YYYY أو YYYY-MM-DD)`
          );
        }
      }

      if (row["تاريخ انشاء امر التوريد"]) {
        const orderDate = parseDate(row["تاريخ انشاء امر التوريد"]);
        if (!orderDate) {
          errors.push(
            `الصف ${rowNumber}: تاريخ انشاء امر التوريد غير صحيح (استخدم تنسيق DD-MM-YYYY أو YYYY-MM-DD)`
          );
        }
      }

      // Validate payment duration
      if (
        row["مدة الدفع ب اليوم"] &&
        (isNaN(parseInt(row["مدة الدفع ب اليوم"])) ||
          parseInt(row["مدة الدفع ب اليوم"]) < 0)
      ) {
        errors.push(`الصف ${rowNumber}: مدة الدفع يجب أن تكون رقماً موجباً`);
      }

      // Validate yes/no fields
      if (row["تم الدفع"] && !["نعم", "لا", ""].includes(row["تم الدفع"])) {
        errors.push(
          `الصف ${rowNumber}: حقل "تم الدفع" يجب أن يكون "نعم" أو "لا"`
        );
      }

      if (row["تم التوصيل"] && !["نعم", "لا", ""].includes(row["تم التوصيل"])) {
        errors.push(
          `الصف ${rowNumber}: حقل "تم التوصيل" يجب أن يكون "نعم" أو "لا"`
        );
      }
    });

    return errors;
  };
  const processImportData = async () => {
    if (!file || previewData.length === 0) {
      CreateToast("يرجى اختيار ملف صالح أولاً", "e");
      return;
    }

    if (validationErrors.length > 0) {
      CreateToast("يرجى تصحيح الأخطاء قبل المتابعة", "e");
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      // Re-parse the full file for import
      let fullData = [];

      if (file.name.endsWith(".csv")) {
        const parseResult = await new Promise((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: resolve,
            error: reject,
          });
        });
        fullData = parseResult.data;
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        fullData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          dateNF: "yyyy-mm-dd",
        });
      }

      // Process each row as a separate purchase order
      for (let i = 0; i < fullData.length; i++) {
        const row = fullData[i];
        const rowNumber = i + 2;

        try {
          // Skip empty rows
          if (!row["اسم الشركة"] || !row["اسم الشركة"].toString().trim()) {
            continue;
          }

          const purchaseOrderId = generateUUID();
          const purchaseOrderNumber = generatePurchaseOrderNumber();
          const customerID = await findOrCreateCustomer(
            row["اسم الشركة"].toString().trim()
          );
          // Create purchase order from row data
          const purchaseOrder = {
            ID: purchaseOrderId,
            purchaseOrderNumber: purchaseOrderNumber,
            clientOrderNumber: row["رقم امر توريد العميل"] || "",
            etktNumber: row["رقم الفاتورة الالكترونية"] || "",
            buyer: customerID,
            buyingAmount: parseFloat(row["سعر الشراء بدون الضريبة"]) || 0,
            sellingAmount: parseFloat(row["سعر البيع بدون الضريبة"]) || 0,
            OrderDescription: row["وصف الطلبية"],
            etktDate: formatDate(row["تاريخ اصدار الفاتورة الالكترونية"]) || "",
            orderDate:
              formatDate(row["تاريخ انشاء امر التوريد"]) ||
              formatDate(new Date()),
            hasGrn: Boolean(row["رقم GRN"]),
            grnNumber: row["رقم GRN"] || "",
            isPaid: row["تم الدفع"] === "نعم",
            isDelivered: row["تم التوصيل"] === "نعم",
            paymentDuration: parseInt(row["مدة الدفع ب اليوم"]) || 30,
            paymentDueDate: calculatePaymentDueDate(
              formatDate(row["تاريخ اصدار الفاتورة الالكترونية"]),
              parseInt(row["مدة الدفع ب اليوم"])
            ),
            notes: row["ملاحظات"] || "",
            notes2: row["ملاحظات اخري"] || "",
            comments: [],
            customDocuments: [],
            items: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await SETDOC("purchaseOrders", purchaseOrderId, purchaseOrder, true);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`الصف ${rowNumber}: ${error.message}`);
          console.error(`Error processing row ${rowNumber}:`, error);
        }
      }

      setImportResults({
        total: fullData.length,
        success: successCount,
        errors: errorCount,
        errorDetails: errors,
      });

      if (successCount > 0) {
        CreateToast(`تم إنشاء ${successCount} أمر شراء بنجاح`, "s");
      }

      if (errorCount > 0) {
        CreateToast(`فشل في إنشاء ${errorCount} أمر شراء`, "w");
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      CreateToast("حدث خطأ أثناء الاستيراد", "e");
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreviewData([]);
    setValidationErrors([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // DataTable columns configuration
  const columns = [
    {
      name: "رقم امر توريد العميل",
      selector: (row) => row["رقم امر توريد العميل"],
      sortable: true,
      width: "200px",
    },
    {
      name: "اسم الشركة",
      selector: (row) => row["اسم الشركة"],
      sortable: true,
      width: "200px",
    },
    {
      name: "سعر الشراء",
      selector: (row) => row["سعر الشراء بدون الضريبة"],
      sortable: true,
      cell: (row) => `${parseFloat(row["سعر الشراء بدون الضريبة"]) || 0}`,
      width: "150px",
    },
    {
      name: "سعر البيع",
      selector: (row) => row["سعر البيع بدون الضريبة"],
      sortable: true,
      cell: (row) => `${parseFloat(row["سعر البيع بدون الضريبة"]) || 0}`,
      width: "150px",
    },
    {
      name: "رقم الفاتورة الالكترونية",
      selector: (row) => row["رقم الفاتورة الالكترونية"],
      sortable: true,
      width: "200px",
    },
    {
      name: "تاريخ الفاتورة",
      selector: (row) => row["تاريخ اصدار الفاتورة الالكترونية"],
      sortable: true,
      width: "150px",
    },
    {
      name: "تاريخ انشاء امر التوريد",
      selector: (row) => row["تاريخ انشاء امر التوريد"],
      sortable: true,
      width: "180px",
    },
    {
      name: "رقم GRN",
      selector: (row) => row["رقم GRN"],
      sortable: true,
      width: "120px",
    },
    {
      name: "تم الدفع",
      selector: (row) => row["تم الدفع"],
      sortable: true,
      cell: (row) => (
        <span style={{ color: row["تم الدفع"] === "نعم" ? "green" : "red" }}>
          {row["تم الدفع"] || "لا"}
        </span>
      ),
      width: "100px",
    },
    {
      name: "تم التوصيل",
      selector: (row) => row["تم التوصيل"],
      sortable: true,
      cell: (row) => (
        <span style={{ color: row["تم التوصيل"] === "نعم" ? "green" : "red" }}>
          {row["تم التوصيل"] || "لا"}
        </span>
      ),
      width: "100px",
    },
  ];

  return (
    <div className="BulkImport">
      <div className="BulkImport-header">
        <h1 className="BulkImport-title">الاستيراد المجمع لأوامر الشراء</h1>
        <button
          onClick={() => setActiveInnerPage("Home")}
          className="BulkImport-backButton"
        >
          الرجوع
        </button>
      </div>

      {/* Instructions Section */}
      <div className="BulkImport-instructions">
        <h3>تعليمات الاستيراد</h3>
        <ul>
          <li>قم بتحميل قالب Excel أو CSV باستخدام الزر أدناه</li>
          <li>املأ البيانات في القالب مع مراعاة الحقول المطلوبة</li>
          <li>
            <strong>تنسيقات التاريخ المدعومة:</strong>
            <ul style={{ marginTop: "5px", marginLeft: "20px" }}>
              <li>DD-MM-YYYY (مثال: 15-01-2024)</li>
              <li>DD/MM/YYYY (مثال: 15/01/2024)</li>
              <li>YYYY-MM-DD (مثال: 2024-01-15)</li>
              <li>YYYY/MM/DD (مثال: 2024/01/15)</li>
            </ul>
          </li>
          <li>استخدم "نعم" أو "لا" للحقول المنطقية</li>
          <li>ارفع الملف المملوء للمعاينة والتحقق من البيانات</li>
          <li>اضغط "بدء الاستيراد" لإنشاء أوامر الشراء</li>
        </ul>

        <button
          onClick={downloadTemplate}
          className="BulkImport-downloadButton"
        >
          تحميل قالب Excel
        </button>
      </div>

      {/* File Upload Section */}
      <div className="BulkImport-uploadArea">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />

        <div className="BulkImport-fileIcon">📁</div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="BulkImport-uploadButton"
        >
          اختيار ملف للاستيراد
        </button>

        <p>يدعم ملفات CSV و Excel (.xlsx, .xls) - الحد الأقصى 10 ميجابايت</p>

        {file && (
          <div className="BulkImport-fileInfo">
            <strong>الملف المحدد:</strong> {file.name} (
            {(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="BulkImport-validationErrors">
          <h4>أخطاء في البيانات ({validationErrors.length})</h4>
          <div className="BulkImport-errorList">
            {validationErrors.map((error, index) => (
              <div key={index} className="BulkImport-errorItem">
                • {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Section with DataTable */}
      {previewData.length > 0 && (
        <div className="BulkImport-preview">
          <h3>معاينة البيانات ({previewData.length} عنصر)</h3>

          <div className="BulkImport-dataTableContainer">
            <DataTable
              columns={columns}
              data={previewData}
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[10, 25, 50, 100, 150, 200, 250]}
              responsive
              theme={
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "dark"
                  : "light"
              }
              highlightOnHover
              striped
              noDataComponent="لا توجد بيانات للعرض"
              paginationComponentOptions={{
                rowsPerPageText: "صفوف في الصفحة:",
                rangeSeparatorText: "من",
                noRowsPerPage: false,
                selectAllRowsItem: false,
              }}
            />
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResults && (
        <div
          className={`BulkImport-results ${
            importResults.errors > 0 ? "warning" : "success"
          }`}
        >
          <h4>نتائج الاستيراد</h4>

          <div style={{ marginBottom: "15px" }}>
            <div>إجمالي العناصر: {importResults.total}</div>
            <div style={{ color: "var(--status-success)" }}>
              نجح الاستيراد: {importResults.success}
            </div>
            <div style={{ color: "var(--status-error)" }}>
              فشل الاستيراد: {importResults.errors}
            </div>
          </div>

          {importResults.errorDetails.length > 0 && (
            <div>
              <strong>تفاصيل الأخطاء:</strong>
              <div className="BulkImport-errorDetails">
                {importResults.errorDetails.map((error, index) => (
                  <div
                    key={index}
                    style={{ color: "#721c24", fontSize: "14px" }}
                  >
                    • {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {previewData.length > 0 && (
        <div className="BulkImport-actions">
          <button
            onClick={processImportData}
            disabled={loading || validationErrors.length > 0}
            className={`BulkImport-actionButton BulkImport-importButton`}
          >
            {loading ? "جاري الاستيراد..." : "بدء الاستيراد"}
          </button>

          <button
            onClick={resetImport}
            disabled={loading}
            className={`BulkImport-actionButton BulkImport-resetButton`}
          >
            إعادة تعيين
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="BulkImport-loadingOverlay">
          <div className="BulkImport-loadingContent">
            <div className="BulkImport-spinner"></div>
            <p>جاري استيراد العناصر...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImportPurchaseOrders;
