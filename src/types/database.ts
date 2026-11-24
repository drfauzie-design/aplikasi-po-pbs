export type UserRole = 'sales' | 'admin_sales';

export type PoStatus = 'Pending Approval' | 'Approved' | 'Revisi' | 'Selesai';

export type UnitType = 'Dus' | 'Pack';

export interface StaffUser {
  id: string;
  nama: string;
  no_hp: string;
  pin?: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  kode_pelanggan: string;
  nama_toko: string;
  telepon: string;
  alamat: string;
  sales_pic: string;
}

export interface Product {
  id: string;
  kode_barang: string;
  nama_barang: string;
  harga_pack: number;
  harga_dus: number;
  stok: number;
}

export interface PurchaseOrder {
  id: string;
  no_po: string;
  customer_id: string;
  dibuat_oleh: string;
  status: PoStatus;
  catatan_revisi: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoItem {
  id: string;
  po_id: string;
  product_id: string;
  nama_barang: string;
  qty: number;
  satuan: UnitType;
  harga_satuan: number;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  customer?: Customer | null;
  po_items: PoItem[];
}

export type AppSession =
  | {
      type: 'customer';
      customer: Customer;
    }
  | {
      type: 'staff';
      user: Omit<StaffUser, 'pin'>;
    };

export interface PoDraftItem {
  localId: string;
  product_id: string;
  nama_barang: string;
  qty: number;
  satuan: UnitType;
  harga_satuan: number;
}
