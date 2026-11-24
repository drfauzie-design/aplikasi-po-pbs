import { createClient } from '@supabase/supabase-js';
import type {
  Customer,
  PoDraftItem,
  PoStatus,
  Product,
  PurchaseOrderWithDetails,
  StaffUser,
} from '../types/database';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://gadsotfbyfnwfriwugyq.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_P4KgUEdDGakrLcWHOvoRLA_yKQwMQg3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '').trim();
}

export async function authenticateStaff(
  noHpInput: string,
  pinInput: string
): Promise<Omit<StaffUser, 'pin'>> {
  const cleanPhone = normalizePhone(noHpInput);
  const cleanPin = pinInput.trim();

  if (!cleanPhone || !cleanPin) {
    throw new Error('Nomor HP dan PIN wajib diisi.');
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, nama, no_hp, pin, role');

  if (error) {
    throw new Error(`Gagal memeriksa akun staff: ${error.message}`);
  }

  const matched = (data as StaffUser[] | null)?.find((u) => {
    const dbPhone = normalizePhone(String(u.no_hp ?? ''));
    const dbPin = String(u.pin ?? '').trim();
    return (
      (dbPhone === cleanPhone ||
        dbPhone.replace(/^(\+62|62)/, '0') === cleanPhone.replace(/^(\+62|62)/, '0')) &&
      dbPin === cleanPin
    );
  });

  if (!matched) {
    throw new Error('Nomor HP atau PIN tidak cocok. Silakan periksa kembali.');
  }

  return {
    id: matched.id,
    nama: matched.nama,
    no_hp: matched.no_hp,
    role: matched.role,
  };
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, kode_pelanggan, nama_toko, telepon, alamat, sales_pic')
    .order('nama_toko', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat data toko: ${error.message}`);
  }

  return ((data ?? []) as Customer[]).map((c) => ({
    ...c,
    kode_pelanggan: c.kode_pelanggan ?? '',
    telepon: c.telepon ?? '',
    sales_pic: c.sales_pic ?? '',
  }));
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, kode_barang, nama_barang, harga_pack, harga_dus, stok')
    .order('nama_barang', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat data barang: ${error.message}`);
  }

  return ((data ?? []) as Product[]).map((p) => ({
    ...p,
    harga_pack: Number(p.harga_pack) || 0,
    harga_dus: Number(p.harga_dus) || 0,
    stok: Number(p.stok) || 0,
  }));
}

export async function fetchPurchaseOrders(
  customerId?: string
): Promise<PurchaseOrderWithDetails[]> {
  let query = supabase
    .from('purchase_orders')
    .select(
      `
      id,
      no_po,
      customer_id,
      dibuat_oleh,
      status,
      catatan_revisi,
      created_at,
      updated_at,
      customer:customers (
        id,
        kode_pelanggan,
        nama_toko,
        telepon,
        alamat,
        sales_pic
      ),
      po_items (
        id,
        po_id,
        product_id,
        nama_barang,
        qty,
        satuan,
        harga_satuan
      )
    `
    )
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal memuat daftar Purchase Order: ${error.message}`);
  }

  return ((data ?? []) as unknown as PurchaseOrderWithDetails[]).map((po) => ({
    ...po,
    customer: Array.isArray(po.customer) ? po.customer[0] ?? null : po.customer ?? null,
    po_items: (po.po_items ?? []).map((item) => ({
      ...item,
      qty: Number(item.qty) || 0,
      harga_satuan: Number(item.harga_satuan) || 0,
    })),
  }));
}

export async function generateNextPoNumber(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `PO-${y}${m}${d}-`;

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('no_po')
    .ilike('no_po', `${prefix}%`)
    .order('no_po', { ascending: false })
    .limit(1);

  if (error) {
    const fallbackSeq = String(Math.floor(100 + Math.random() * 899));
    return `${prefix}${fallbackSeq}`;
  }

  let nextNumber = 1;
  if (data && data.length > 0 && data[0].no_po) {
    const lastPart = String(data[0].no_po).replace(prefix, '');
    const parsed = parseInt(lastPart, 10);
    if (!Number.isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

export async function createPurchaseOrder(params: {
  customerId: string;
  dibuatOleh: string;
  items: PoDraftItem[];
}): Promise<PurchaseOrderWithDetails> {
  const validItems = params.items.filter(
    (item) => item.product_id && item.nama_barang && item.qty > 0
  );

  if (validItems.length === 0) {
    throw new Error('Tambahkan minimal 1 barang dengan jumlah valid.');
  }

  const noPo = await generateNextPoNumber();
  const nowIso = new Date().toISOString();

  const { data: insertedPo, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      no_po: noPo,
      customer_id: params.customerId,
      dibuat_oleh: params.dibuatOleh,
      status: 'Pending Approval',
      catatan_revisi: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, no_po, customer_id, dibuat_oleh, status, catatan_revisi, created_at, updated_at')
    .single();

  if (poError || !insertedPo) {
    throw new Error(`Gagal menyimpan Purchase Order: ${poError?.message ?? 'Unknown error'}`);
  }

  const itemRows = validItems.map((item) => ({
    po_id: insertedPo.id,
    product_id: item.product_id,
    nama_barang: item.nama_barang,
    qty: item.qty,
    satuan: item.satuan,
    harga_satuan: item.harga_satuan,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from('po_items')
    .insert(itemRows)
    .select('id, po_id, product_id, nama_barang, qty, satuan, harga_satuan');

  if (itemsError) {
    await supabase.from('purchase_orders').delete().eq('id', insertedPo.id);
    throw new Error(`Gagal menyimpan item pesanan: ${itemsError.message}`);
  }

  return {
    ...(insertedPo as PurchaseOrderWithDetails),
    po_items: (insertedItems ?? []) as PurchaseOrderWithDetails['po_items'],
  };
}

export async function updatePurchaseOrderItems(params: {
  poId: string;
  currentStatus: PoStatus;
  items: PoDraftItem[];
}): Promise<{ newStatus: PoStatus }> {
  const validItems = params.items.filter(
    (item) => item.product_id && item.nama_barang && item.qty > 0
  );

  if (validItems.length === 0) {
    throw new Error('Pesanan harus memiliki minimal 1 barang dengan jumlah lebih dari 0.');
  }

  // Rule: If an Approved PO is edited by Customer or Sales, reset status to Pending Approval
  const nextStatus: PoStatus =
    params.currentStatus === 'Approved' ? 'Pending Approval' : params.currentStatus;

  const nowIso = new Date().toISOString();

  const updatePayload: {
    status: PoStatus;
    updated_at: string;
    catatan_revisi?: null;
  } = {
    status: nextStatus,
    updated_at: nowIso,
  };
  if (nextStatus === 'Pending Approval') {
    updatePayload.catatan_revisi = null;
  }

  const { error: updatePoError } = await supabase
    .from('purchase_orders')
    .update(updatePayload)
    .eq('id', params.poId);

  if (updatePoError) {
    throw new Error(`Gagal memperbarui status PO: ${updatePoError.message}`);
  }

  const { error: deleteError } = await supabase
    .from('po_items')
    .delete()
    .eq('po_id', params.poId);

  if (deleteError) {
    throw new Error(`Gagal memperbarui item PO: ${deleteError.message}`);
  }

  const itemRows = validItems.map((item) => ({
    po_id: params.poId,
    product_id: item.product_id,
    nama_barang: item.nama_barang,
    qty: item.qty,
    satuan: item.satuan,
    harga_satuan: item.harga_satuan,
  }));

  const { error: insertError } = await supabase.from('po_items').insert(itemRows);

  if (insertError) {
    throw new Error(`Gagal menyimpan item PO baru: ${insertError.message}`);
  }

  return { newStatus: nextStatus };
}

export async function updatePurchaseOrderStatus(params: {
  poId: string;
  status: PoStatus;
  catatanRevisi?: string | null;
}): Promise<void> {
  if (params.status === 'Revisi' && !params.catatanRevisi?.trim()) {
    throw new Error('Catatan revisi wajib diisi sebelum mengubah status menjadi Revisi.');
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: params.status,
      catatan_revisi:
        params.status === 'Revisi' ? params.catatanRevisi?.trim() ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.poId);

  if (error) {
    throw new Error(`Gagal mengubah status PO: ${error.message}`);
  }
}

export async function createCustomer(payload: Omit<Customer, 'id'>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      kode_pelanggan: (payload.kode_pelanggan ?? '').trim(),
      nama_toko: payload.nama_toko.trim(),
      telepon: (payload.telepon ?? '').trim(),
      alamat: payload.alamat.trim(),
      sales_pic: (payload.sales_pic ?? '').trim(),
    })
    .select('id, kode_pelanggan, nama_toko, telepon, alamat, sales_pic')
    .single();

  if (error || !data) {
    throw new Error(`Gagal menambah toko: ${error?.message ?? 'Unknown error'}`);
  }
  return {
    ...(data as Customer),
    kode_pelanggan: data.kode_pelanggan ?? '',
    telepon: data.telepon ?? '',
    sales_pic: data.sales_pic ?? '',
  };
}

export async function updateCustomer(
  id: string,
  payload: Omit<Customer, 'id'>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      kode_pelanggan: (payload.kode_pelanggan ?? '').trim(),
      nama_toko: payload.nama_toko.trim(),
      telepon: (payload.telepon ?? '').trim(),
      alamat: payload.alamat.trim(),
      sales_pic: (payload.sales_pic ?? '').trim(),
    })
    .eq('id', id)
    .select('id, kode_pelanggan, nama_toko, telepon, alamat, sales_pic')
    .single();

  if (error || !data) {
    throw new Error(`Gagal memperbarui data toko: ${error?.message ?? 'Unknown error'}`);
  }
  return {
    ...(data as Customer),
    kode_pelanggan: data.kode_pelanggan ?? '',
    telepon: data.telepon ?? '',
    sales_pic: data.sales_pic ?? '',
  };
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) {
    throw new Error(
      `Gagal menghapus toko (pastikan toko tidak memiliki PO aktif): ${error.message}`
    );
  }
}

export async function deleteCustomersByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('customers').delete().in('id', ids);

  if (error) {
    throw new Error(
      `Gagal menghapus data customer terpilih (pastikan tidak ada PO yang terhubung ke toko tersebut): ${error.message}`
    );
  }
}

export async function bulkInsertCustomers(rows: Omit<Customer, 'id'>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from('customers')
    .insert(
      rows.map((r) => ({
        kode_pelanggan: (r.kode_pelanggan ?? '').trim(),
        nama_toko: r.nama_toko.trim(),
        telepon: (r.telepon ?? '').trim(),
        alamat: r.alamat.trim(),
        sales_pic: (r.sales_pic ?? '').trim(),
      }))
    )
    .select('id');

  if (error) {
    throw new Error(`Gagal mengimpor data toko: ${error.message}`);
  }
  return data?.length ?? rows.length;
}

export async function createProduct(payload: Omit<Product, 'id'>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      kode_barang: payload.kode_barang.trim(),
      nama_barang: payload.nama_barang.trim(),
      harga_pack: Number(payload.harga_pack) || 0,
      harga_dus: Number(payload.harga_dus) || 0,
      stok: Math.max(0, Math.floor(Number(payload.stok) || 0)),
    })
    .select('id, kode_barang, nama_barang, harga_pack, harga_dus, stok')
    .single();

  if (error || !data) {
    throw new Error(`Gagal menambah barang: ${error?.message ?? 'Unknown error'}`);
  }
  return {
    ...(data as Product),
    harga_pack: Number(data.harga_pack) || 0,
    harga_dus: Number(data.harga_dus) || 0,
    stok: Number(data.stok) || 0,
  };
}

export async function updateProduct(
  id: string,
  payload: Omit<Product, 'id'>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      kode_barang: payload.kode_barang.trim(),
      nama_barang: payload.nama_barang.trim(),
      harga_pack: Number(payload.harga_pack) || 0,
      harga_dus: Number(payload.harga_dus) || 0,
      stok: Math.max(0, Math.floor(Number(payload.stok) || 0)),
    })
    .eq('id', id)
    .select('id, kode_barang, nama_barang, harga_pack, harga_dus, stok')
    .single();

  if (error || !data) {
    throw new Error(`Gagal memperbarui data barang: ${error?.message ?? 'Unknown error'}`);
  }
  return {
    ...(data as Product),
    harga_pack: Number(data.harga_pack) || 0,
    harga_dus: Number(data.harga_dus) || 0,
    stok: Number(data.stok) || 0,
  };
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    throw new Error(
      `Gagal menghapus barang (pastikan barang tidak terhubung ke PO): ${error.message}`
    );
  }
}

export async function deleteProductsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('products').delete().in('id', ids);

  if (error) {
    throw new Error(
      `Gagal menghapus data barang terpilih (pastikan tidak ada item PO yang terhubung ke barang tersebut): ${error.message}`
    );
  }
}

export async function bulkInsertProducts(rows: Omit<Product, 'id'>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from('products')
    .insert(
      rows.map((r) => ({
        kode_barang: r.kode_barang.trim(),
        nama_barang: r.nama_barang.trim(),
        harga_pack: Number(r.harga_pack) || 0,
        harga_dus: Number(r.harga_dus) || 0,
        stok: Math.max(0, Math.floor(Number(r.stok) || 0)),
      }))
    )
    .select('id');

  if (error) {
    throw new Error(`Gagal mengimpor data barang: ${error.message}`);
  }
  return data?.length ?? rows.length;
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nama, no_hp, pin, role')
    .order('nama', { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat daftar staff / sales: ${error.message}`);
  }

  return (data ?? []) as StaffUser[];
}

export async function createStaffUser(payload: {
  nama: string;
  no_hp: string;
  pin: string;
  role: StaffUser['role'];
}): Promise<StaffUser> {
  const cleanPin = payload.pin.trim();
  if (!/^\d{4,6}$/.test(cleanPin)) {
    throw new Error('PIN harus terdiri dari 4 hingga 6 digit angka.');
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      nama: payload.nama.trim(),
      no_hp: payload.no_hp.trim(),
      pin: cleanPin,
      role: payload.role,
    })
    .select('id, nama, no_hp, pin, role')
    .single();

  if (error || !data) {
    throw new Error(`Gagal menambah akun staff: ${error?.message ?? 'Unknown error'}`);
  }
  return data as StaffUser;
}

export async function updateStaffUser(
  id: string,
  payload: {
    nama: string;
    no_hp: string;
    pin?: string;
    role: StaffUser['role'];
  }
): Promise<StaffUser> {
  const updateBody: {
    nama: string;
    no_hp: string;
    role: StaffUser['role'];
    pin?: string;
  } = {
    nama: payload.nama.trim(),
    no_hp: payload.no_hp.trim(),
    role: payload.role,
  };

  if (payload.pin !== undefined && payload.pin.trim() !== '') {
    const cleanPin = payload.pin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      throw new Error('PIN harus terdiri dari 4 hingga 6 digit angka.');
    }
    updateBody.pin = cleanPin;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateBody)
    .eq('id', id)
    .select('id, nama, no_hp, pin, role')
    .single();

  if (error || !data) {
    throw new Error(`Gagal memperbarui akun staff: ${error?.message ?? 'Unknown error'}`);
  }
  return data as StaffUser;
}

export async function deleteStaffUser(id: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) {
    throw new Error(`Gagal menghapus akun staff: ${error.message}`);
  }
}
