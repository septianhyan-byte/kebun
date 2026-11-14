import React from 'react';
import { SelfSalePaymentProfile, SelfSaleReceipt } from '../types';
import { formatDateShortId } from '../utils/dateUtils';

interface PrintableReceiptProps {
  receipt: SelfSaleReceipt;
  paymentProfile: SelfSalePaymentProfile;
  previewMode?: boolean;
}

function fmtRp(val: number): string {
  const abs = Math.round(Math.abs(val));
  const prefix = val < 0 ? '-Rp ' : 'Rp ';
  return `${prefix}${abs.toLocaleString('id-ID')}`;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  receipt,
  paymentProfile,
  previewMode = false,
}) => {
  const isThermal = receipt.paperFormat === 'thermal80';
  const hasBankInfo =
    paymentProfile.bankName.trim() !== '' ||
    paymentProfile.accountNumber.trim() !== '' ||
    paymentProfile.accountHolderName.trim() !== '';
  const hasQris = Boolean(paymentProfile.qrisImageDataUrl);

  if (isThermal) {
    return (
      <div
        className={
          previewMode
            ? 'mx-auto w-full max-w-[330px] rounded-lg border border-gray-300 bg-white p-4 text-gray-900 shadow-sm'
            : 'hidden print:block mx-auto w-[78mm] bg-white p-2 text-black'
        }
      >
        <div className="border-b border-dashed border-gray-400 pb-2.5 text-center space-y-0.5">
          <div className="text-sm font-bold uppercase tracking-tight">
            {paymentProfile.storeName || 'Kebun MelonFlow NFT'}
          </div>
          {paymentProfile.storeAddress && (
            <div className="text-[10px] text-gray-700 leading-snug">
              {paymentProfile.storeAddress}
            </div>
          )}
          {paymentProfile.storePhone && (
            <div className="text-[10px] font-mono-tabular text-gray-700">
              Telp / WA: {paymentProfile.storePhone}
            </div>
          )}
          <div className="pt-1 text-[10px] font-semibold tracking-wide text-gray-800">
            NOTA PENJUALAN LANGSUNG
          </div>
        </div>

        <div className="border-b border-dashed border-gray-400 py-2 text-[11px] space-y-0.5 font-mono-tabular">
          <div className="flex justify-between gap-2">
            <span className="text-gray-600">No Nota</span>
            <span className="font-bold">{receipt.receiptNumber}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600">Tanggal</span>
            <span>{formatDateShortId(receipt.date)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600">Asal GH</span>
            <span>{receipt.ghName}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600">Pembeli</span>
            <span className="font-semibold text-right">
              {receipt.buyerName || 'Pelanggan Langsung'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600">Metode</span>
            <span>{receipt.paymentMethod}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-gray-400 py-2 space-y-1.5 text-[11px]">
          {receipt.items.map((item) => (
            <div key={item.id}>
              <div className="font-semibold">{item.name || 'Melon Segar'}</div>
              <div className="flex justify-between font-mono-tabular text-gray-700">
                <span>
                  {item.weightKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg ×{' '}
                  {fmtRp(item.pricePerKg)}
                </span>
                <span className="font-bold text-gray-900">{fmtRp(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-b border-dashed border-gray-400 py-2 text-[11px] space-y-1 font-mono-tabular">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Berat</span>
            <span className="font-semibold">
              {receipt.totalWeightKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL BAYAR</span>
            <span>{fmtRp(receipt.totalAmount)}</span>
          </div>
          {receipt.notes && (
            <div className="pt-1 text-[10px] font-sans text-gray-700">
              Catatan: {receipt.notes}
            </div>
          )}
        </div>

        {(hasBankInfo || hasQris) && (
          <div className="border-b border-dashed border-gray-400 py-2.5 text-center space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-700">
              Informasi Pembayaran
            </div>
            {hasBankInfo && (
              <div className="rounded border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-[11px] text-left space-y-0.5">
                {paymentProfile.bankName.trim() && (
                  <div>
                    <span className="text-gray-600">Bank: </span>
                    <strong>{paymentProfile.bankName}</strong>
                  </div>
                )}
                {paymentProfile.accountNumber.trim() && (
                  <div className="font-mono-tabular">
                    <span className="text-gray-600 font-sans">No. Rek: </span>
                    <strong className="text-xs">{paymentProfile.accountNumber}</strong>
                  </div>
                )}
                {paymentProfile.accountHolderName.trim() && (
                  <div>
                    <span className="text-gray-600">A/N: </span>
                    <strong>{paymentProfile.accountHolderName}</strong>
                  </div>
                )}
              </div>
            )}
            {hasQris && (
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <span className="text-[10px] font-semibold text-gray-700">Scan QRIS</span>
                <img
                  src={paymentProfile.qrisImageDataUrl}
                  alt="Barcode QRIS Pembayaran"
                  referrerPolicy="no-referrer"
                  className="max-h-44 max-w-[180px] w-auto rounded border border-gray-300 bg-white p-1 object-contain"
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-2.5 text-center text-[10px] text-gray-700 space-y-0.5">
          <div>{paymentProfile.footerNote || 'Terima kasih atas pembelian Anda.'}</div>
          <div className="text-[9px] text-gray-500 font-mono-tabular">
            Dicetak: {new Date().toLocaleString('id-ID')}
          </div>
        </div>
      </div>
    );
  }

  // Formal A4 / A5 Invoice Receipt Layout
  return (
    <div
      className={
        previewMode
          ? 'mx-auto w-full min-w-[480px] rounded-lg border border-gray-300 bg-white p-6 text-gray-900 shadow-sm space-y-4'
          : 'hidden print:block bg-white text-black p-4 space-y-4'
      }
    >
      {/* Invoice Header */}
      <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            {paymentProfile.storeName || 'Kebun MelonFlow NFT'}
          </h1>
          {paymentProfile.storeAddress && (
            <div className="text-xs text-gray-600 mt-0.5">{paymentProfile.storeAddress}</div>
          )}
          {paymentProfile.storePhone && (
            <div className="text-xs text-gray-700 font-mono-tabular">
              Telp / WA: {paymentProfile.storePhone}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-bold uppercase tracking-wide">NOTA PENJUALAN</div>
          <div className="text-xs font-mono-tabular font-semibold mt-0.5">
            {receipt.receiptNumber}
          </div>
          <div className="text-xs text-gray-600 font-mono-tabular">
            {formatDateShortId(receipt.date)}
          </div>
        </div>
      </div>

      {/* Buyer & Transaction Info */}
      <div className="grid grid-cols-3 gap-3 rounded border border-gray-300 bg-gray-50 p-3 text-xs">
        <div>
          <div className="text-gray-500">Pembeli / Pelanggan</div>
          <div className="font-bold mt-0.5">{receipt.buyerName || 'Pelanggan Langsung'}</div>
          {receipt.buyerPhone && (
            <div className="text-[11px] font-mono-tabular text-gray-600">{receipt.buyerPhone}</div>
          )}
        </div>
        <div>
          <div className="text-gray-500">Kategori &amp; Asal Kebun</div>
          <div className="font-semibold mt-0.5">Jual sendiri · {receipt.ghName}</div>
        </div>
        <div>
          <div className="text-gray-500">Metode Pembayaran</div>
          <div className="font-semibold mt-0.5">{receipt.paymentMethod}</div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-3 py-2 text-left">No</th>
            <th className="border border-gray-300 px-3 py-2 text-left">Nama Produk / Varietas Melon</th>
            <th className="border border-gray-300 px-3 py-2 text-right">Berat (kg)</th>
            <th className="border border-gray-300 px-3 py-2 text-right">Harga / kg</th>
            <th className="border border-gray-300 px-3 py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-gray-300 px-3 py-2 font-mono-tabular">{idx + 1}</td>
              <td className="border border-gray-300 px-3 py-2 font-medium">
                {item.name || 'Melon Segar'}
              </td>
              <td className="border border-gray-300 px-3 py-2 text-right font-mono-tabular">
                {item.weightKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
              </td>
              <td className="border border-gray-300 px-3 py-2 text-right font-mono-tabular">
                {fmtRp(item.pricePerKg)}
              </td>
              <td className="border border-gray-300 px-3 py-2 text-right font-bold font-mono-tabular">
                {fmtRp(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-bold">
            <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right">
              Total Keseluruhan
            </td>
            <td className="border border-gray-300 px-3 py-2 text-right font-mono-tabular">
              {receipt.totalWeightKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
            </td>
            <td className="border border-gray-300 px-3 py-2 text-right text-gray-500">—</td>
            <td className="border border-gray-300 px-3 py-2 text-right text-sm font-mono-tabular">
              {fmtRp(receipt.totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {receipt.notes && (
        <div className="rounded border border-gray-200 px-3 py-2 text-xs text-gray-700">
          <strong>Catatan:</strong> {receipt.notes}
        </div>
      )}

      {/* Payment Info: Bank Account + QRIS Barcode */}
      {(hasBankInfo || hasQris) && (
        <div className="print-break-inside-avoid grid grid-cols-1 sm:grid-cols-2 gap-4 rounded border border-gray-300 p-3.5 items-center">
          <div className="space-y-1.5 text-xs">
            <div className="font-bold text-gray-800 uppercase tracking-wide text-[11px]">
              Pembayaran Transfer Rekening
            </div>
            {hasBankInfo ? (
              <div className="space-y-1">
                {paymentProfile.bankName.trim() && (
                  <div>
                    <span className="text-gray-600">Bank / E-Wallet: </span>
                    <strong>{paymentProfile.bankName}</strong>
                  </div>
                )}
                {paymentProfile.accountNumber.trim() && (
                  <div className="font-mono-tabular text-sm">
                    <span className="text-gray-600 text-xs font-sans">No. Rekening: </span>
                    <strong>{paymentProfile.accountNumber}</strong>
                  </div>
                )}
                {paymentProfile.accountHolderName.trim() && (
                  <div>
                    <span className="text-gray-600">Atas Nama: </span>
                    <strong>{paymentProfile.accountHolderName}</strong>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">
                Pembayaran melalui QRIS di samping atau tunai langsung.
              </p>
            )}
          </div>

          {hasQris && (
            <div className="flex flex-col items-center sm:items-end gap-1">
              <div className="text-[11px] font-bold text-gray-800">Scan Barcode QRIS</div>
              <img
                src={paymentProfile.qrisImageDataUrl}
                alt="Barcode QRIS Pembayaran"
                referrerPolicy="no-referrer"
                className="max-h-44 max-w-[180px] w-auto rounded border border-gray-300 bg-white p-1.5 object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Footer & Signatures */}
      <div className="pt-4 flex items-end justify-between text-xs border-t border-gray-200">
        <div className="space-y-1 text-gray-700">
          <div className="font-medium">
            {paymentProfile.footerNote || 'Terima kasih telah berbelanja melon segar kebun kami.'}
          </div>
          <div className="text-[10px] text-gray-500 font-mono-tabular">
            Dicetak: {new Date().toLocaleString('id-ID')} · MelonFlow NFT
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-600">Hormat kami,</div>
          <div className="mt-10 border-t border-gray-400 w-40 pt-1 font-semibold">
            {paymentProfile.storeName || 'Kebun MelonFlow NFT'}
          </div>
        </div>
      </div>
    </div>
  );
};
