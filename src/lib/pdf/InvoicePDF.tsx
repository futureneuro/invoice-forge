'use client';

import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Svg,
    Path,
    Circle,
    Image,
} from '@react-pdf/renderer';
import type { InvoiceConfig, TimeEntry } from '@/types';
import { groupBy, totalHours, formatCurrency } from '@/lib/utils';

// Register fonts
Font.register({
    family: 'Inter',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf', fontWeight: 400, fontStyle: 'normal' },
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjQ.ttf', fontWeight: 600, fontStyle: 'normal' },
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf', fontWeight: 700, fontStyle: 'normal' },
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYAZ9hjQ.ttf', fontWeight: 800, fontStyle: 'normal' },
        // Italic fallbacks (map to normal)
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf', fontWeight: 400, fontStyle: 'italic' },
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjQ.ttf', fontWeight: 600, fontStyle: 'italic' },
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf', fontWeight: 700, fontStyle: 'italic' },
    ],
});

Font.registerHyphenationCallback((word) => [word]);

const ACCENT = '#e85d4a';

const s = StyleSheet.create({
    page: {
        fontFamily: 'Inter',
        fontSize: 8,
        padding: '28px 36px 50px 36px',
        color: '#111',
        backgroundColor: '#fff',
        position: 'relative',
    },
    accentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: ACCENT,
    },
    // ---- Header ----
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    companyName: {
        fontSize: 18,
        fontWeight: 600,
        color: '#222',
        marginLeft: 8,
    },
    invoiceTitleWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    invoiceTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: '#111',
        marginRight: 8,
    },
    invoiceNSymbol: {
        fontSize: 11,
        fontWeight: 400,
        color: ACCENT,
    },
    invoiceNumber: {
        fontSize: 20,
        fontWeight: 700,
        color: ACCENT,
    },
    // ---- Billing Row ----
    billingRow: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 12,
    },
    billingCol: {
        flex: 1,
    },
    billingLabel: {
        fontSize: 7,
        fontWeight: 700,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    billingName: {
        fontSize: 8,
        fontWeight: 700,
        marginBottom: 2,
    },
    billingText: {
        fontSize: 7,
        color: '#444',
        lineHeight: 1.5,
    },
    // ---- Section Title ----
    sectionTitle: {
        fontSize: 10,
        fontWeight: 700,
        color: '#333',
        marginBottom: 4,
        marginTop: 6,
    },
    summaryText: {
        fontSize: 7.5,
        lineHeight: 1.5,
        color: '#444',
        marginBottom: 8,
    },
    // ---- Compact Table ----
    table: {
        width: '100%',
        marginBottom: 6,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee',
    },
    th: {
        padding: '4px 6px',
        fontSize: 6.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        color: '#555',
    },
    td: {
        padding: '3px 6px',
        fontSize: 7,
    },
    tdBold: {
        padding: '3px 6px',
        fontSize: 7,
        fontWeight: 700,
    },
    tdRight: {
        padding: '3px 6px',
        fontSize: 7,
        textAlign: 'right',
    },
    // ---- Total ----
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 8,
    },
    totalLabel: {
        fontSize: 10,
        fontWeight: 600,
        color: '#444',
    },
    totalLabelCurrency: {
        fontSize: 10,
        fontWeight: 400,
        color: '#888',
    },
    totalAmount: {
        fontSize: 22,
        fontWeight: 800,
        color: ACCENT,
    },
    // ---- Payment ----
    paymentBox: {
        backgroundColor: '#f5f3f0',
        borderRadius: 4,
        padding: '8px 14px',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    paymentTitle: {
        fontSize: 9,
        fontWeight: 600,
        color: ACCENT,
    },
    paymentLine: {
        fontSize: 7,
        color: '#333',
        marginBottom: 1,
        textAlign: 'right',
    },
    paymentLineLabel: {
        fontSize: 7,
        fontWeight: 700,
        color: '#333',
    },
    paymentLineValue: {
        fontSize: 7,
        fontWeight: 700,
        color: '#111',
    },
    // ---- Note ----
    noteTitle: {
        fontSize: 8,
        fontWeight: 700,
        color: '#555',
        marginBottom: 2,
    },
    noteText: {
        fontSize: 6.5,
        lineHeight: 1.5,
        color: '#444',
        marginBottom: 8,
    },
    // ---- Role Section Header ----
    roleSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        padding: '4px 6px',
        marginTop: 4,
        marginBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    roleSectionTitle: {
        fontSize: 8,
        fontWeight: 700,
        color: '#222',
    },
    roleSectionHours: {
        fontSize: 7,
        fontWeight: 600,
        color: ACCENT,
    },
    // ---- Footer ----
    footerBar: {
        position: 'absolute',
        bottom: 16,
        left: 36,
        right: 36,
        borderTopWidth: 1,
        borderTopColor: '#ddd',
        paddingTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 7,
        color: '#888',
    },
});

// ---- Logo Component ----
function Ou2ThereLogo() {
    return (
        <Svg width={30} height={30} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="46" stroke="#222" strokeWidth="4" fill="none" />
            <Path d="M30 65 L50 30 L70 65" stroke="#222" strokeWidth="4" fill="none" strokeLinejoin="round" />
            <Path d="M40 65 L55 42 L70 65" stroke="#222" strokeWidth="3" fill="none" strokeLinejoin="round" />
        </Svg>
    );
}

// ---- Auto-generate invoice summary from timesheet data ----
function generateSummary(invoice: InvoiceConfig, roleStats: { label: string; hours: number; count?: number }[]): string {
    const totalHrs = roleStats.reduce((sum, r) => sum + r.hours, 0);
    const roleDescriptions = roleStats.map(r => {
        const countStr = r.count ? ` (${r.count})` : '';
        return `${r.label}${countStr}: ${r.hours.toFixed(1)} hrs`;
    }).join(', ');

    return `This invoice covers ${totalHrs.toFixed(1)} hours of services for ${invoice.sprintName} (${invoice.dateRange}), including ${roleDescriptions}.`;
}

// ---- Main Component ----
interface InvoicePDFProps {
    invoice: InvoiceConfig;
    logoDataUrl?: string;
}

export function InvoicePDF({ invoice, logoDataUrl }: InvoicePDFProps) {
    const grouped = groupBy(invoice.entries, 'role');

    const roleLabels: Record<string, string> = {
        developer: 'Developers',
        qa: 'QA',
        uxui: 'UX/UI',
        content: 'Content Design',
        pm: 'Project Management',
        advisor: 'Technical Advisor',
    };

    const roleStats = Object.entries(grouped).map(([role, roleEntries]) => {
        const hours = totalHours(roleEntries);
        const rateConfig = invoice.roles.find((r) => r.role === role);
        const rate = rateConfig?.rate || 120;
        const resources = [...new Set(roleEntries.map((e) => e.resource))];
        return {
            role,
            label: rateConfig?.label || roleLabels[role] || role,
            count: resources.length > 1 ? resources.length : undefined,
            hours,
            rate,
            total: Math.round(hours * rate * 100) / 100,
        };
    });

    const grandTotal = roleStats.reduce((sum, r) => sum + r.total, 0);

    // Auto-generate summary if not provided
    const summaryText = invoice.summary || generateSummary(invoice, roleStats);

    return (
        <Document>
            {/* Single-page invoice */}
            <Page size="A4" style={s.page}>
                <View style={s.accentBar} />

                {/* ---- Header: Logo + Invoice Title ---- */}
                <View style={s.headerRow}>
                    <View style={s.logoSection}>
                        {logoDataUrl ? (
                            <Image src={logoDataUrl} style={{ width: 30, height: 30, objectFit: 'contain' }} />
                        ) : (
                            <Ou2ThereLogo />
                        )}
                        <Text style={s.companyName}>{invoice.company.name}</Text>
                    </View>
                    <View style={s.invoiceTitleWrap}>
                        <Text style={s.invoiceTitle}>Invoice </Text>
                        <Text style={s.invoiceNSymbol}>N° </Text>
                        <Text style={s.invoiceNumber}>{invoice.invoiceNumber}</Text>
                    </View>
                </View>

                {/* ---- Billing: TO / FROM / INFO ---- */}
                <View style={s.billingRow}>
                    <View style={s.billingCol}>
                        <Text style={[s.billingLabel, { color: ACCENT }]}>To:</Text>
                        <Text style={s.billingName}>{invoice.client.name}</Text>
                        <Text style={s.billingText}>
                            {invoice.client.address}{'\n'}
                            {invoice.client.city}, {invoice.client.state}{'\n'}
                            {invoice.client.zip}, {invoice.client.country}
                        </Text>
                    </View>
                    <View style={s.billingCol}>
                        <Text style={[s.billingLabel, { color: '#333', textDecoration: 'underline' }]}>From:</Text>
                        <Text style={s.billingName}>{invoice.company.name}</Text>
                        <Text style={s.billingText}>
                            {invoice.company.address}{'\n'}
                            {invoice.company.city}, {invoice.company.state}{'\n'}
                            {invoice.company.zip}, {invoice.company.country}
                        </Text>
                    </View>
                    <View style={s.billingCol}>
                        <Text style={[s.billingLabel, { color: '#333', textDecoration: 'underline' }]}>Info:</Text>
                        <Text style={s.billingText}>
                            Date: {invoice.date}{'\n'}
                            Ref: {invoice.reference}
                        </Text>
                    </View>
                </View>

                {/* ---- Invoice Summary (auto-generated) ---- */}
                <Text style={s.sectionTitle}>Invoice Summary</Text>
                <Text style={s.summaryText}>{summaryText}</Text>

                {/* ---- Role Summary Table ---- */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <Text style={[s.th, { flex: 3 }]}>Resource</Text>
                        <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Hours</Text>
                        <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Rate</Text>
                        <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Total</Text>
                    </View>
                    {roleStats.map((rs) => (
                        <View key={rs.role} style={s.tableRow}>
                            <Text style={[s.tdBold, { flex: 3 }]}>
                                {rs.label}{rs.count ? ` (${rs.count})` : ''}
                            </Text>
                            <Text style={[s.tdBold, { flex: 1, textAlign: 'right' }]}>
                                {rs.hours.toFixed(1)}
                            </Text>
                            <Text style={[s.td, { flex: 1, textAlign: 'right', color: '#666' }]}>
                                ${rs.rate}/hr
                            </Text>
                            <Text style={[s.tdBold, { flex: 1, textAlign: 'right', color: ACCENT }]}>
                                {formatCurrency(rs.total)}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* ---- Total ---- */}
                <View style={s.totalRow}>
                    <Text style={s.totalLabel}>
                        Total <Text style={s.totalLabelCurrency}>(USD)</Text>
                    </Text>
                    <Text style={s.totalAmount}>{formatCurrency(grandTotal)}</Text>
                </View>

                {/* ---- Payment Details ---- */}
                <View style={s.paymentBox}>
                    <Text style={s.paymentTitle}>Payment Details</Text>
                    <View style={{ textAlign: 'right' }}>
                        {invoice.payment.accountHolder && (
                            <Text style={s.paymentLine}>
                                <Text style={s.paymentLineLabel}>NAME: </Text>
                                <Text style={s.paymentLineValue}>{invoice.payment.accountHolder}</Text>
                            </Text>
                        )}
                        {invoice.payment.accountNumber && (
                            <Text style={s.paymentLine}>
                                <Text style={s.paymentLineLabel}>ACCOUNT NO: </Text>
                                <Text style={s.paymentLineValue}>{invoice.payment.accountNumber}</Text>
                            </Text>
                        )}
                        {invoice.payment.routingNumber && (
                            <Text style={s.paymentLine}>
                                <Text style={s.paymentLineLabel}>ROUTING NO: </Text>
                                <Text style={s.paymentLineValue}>{invoice.payment.routingNumber}</Text>
                            </Text>
                        )}
                        {invoice.payment.accountType && (
                            <Text style={s.paymentLine}>
                                <Text style={s.paymentLineLabel}>ACCOUNT TYPE: </Text>
                                <Text style={s.paymentLineValue}>{invoice.payment.accountType}</Text>
                            </Text>
                        )}
                    </View>
                </View>

                {/* ---- Note (compact) ---- */}
                {invoice.note && (
                    <View>
                        <Text style={s.noteTitle}>Note</Text>
                        <Text style={s.noteText}>{invoice.note}</Text>
                    </View>
                )}

                {/* ---- Time Log by Role (matches editor format) ---- */}
                <Text style={s.sectionTitle}>Time Log</Text>
                {Object.entries(grouped).map(([role, roleEntries]) => {
                    const rateConfig = invoice.roles.find((r) => r.role === role);
                    const label = rateConfig?.label || roleLabels[role] || role;
                    const hrs = totalHours(roleEntries);
                    return (
                        <View key={role}>
                            {/* Role section header */}
                            <View style={s.roleSectionHeader} wrap={false}>
                                <Text style={s.roleSectionTitle}>{label} ({roleEntries.length} entries)</Text>
                                <Text style={s.roleSectionHours}>{hrs.toFixed(1)} hrs</Text>
                            </View>
                            {/* Entries table for this role */}
                            <View style={s.table}>
                                <View style={s.tableHeader} wrap={false}>
                                    <Text style={[s.th, { width: 62 }]}>Date</Text>
                                    <Text style={[s.th, { width: 72 }]}>Category</Text>
                                    <Text style={[s.th, { flex: 2 }]}>Task</Text>
                                    <Text style={[s.th, { width: 32, textAlign: 'right' }]}>Hrs</Text>
                                    <Text style={[s.th, { flex: 3 }]}>Description</Text>
                                </View>
                                {roleEntries.map((entry: TimeEntry, idx: number) => (
                                    <View key={idx} style={[s.tableRow, idx % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]} wrap={false}>
                                        <Text style={[s.td, { width: 62, fontSize: 7 }]}>{entry.date}</Text>
                                        <Text style={[s.td, { width: 72, fontSize: 7 }]}>{entry.category}</Text>
                                        <Text style={[s.td, { flex: 2, fontSize: 7 }]}>{entry.taskName}</Text>
                                        <Text style={[s.tdRight, { width: 32, fontSize: 7, fontWeight: 600 }]}>{entry.timeSpent.toFixed(1)}</Text>
                                        <Text style={[s.td, { flex: 3, fontSize: 6.5, lineHeight: 1.4, color: '#444' }]}>{entry.description}</Text>
                                    </View>
                                ))}
                                {/* Role total row */}
                                <View style={[s.tableRow, { backgroundColor: '#f0f0f0' }]} wrap={false}>
                                    <Text style={[s.tdBold, { width: 62 }]}></Text>
                                    <Text style={[s.tdBold, { width: 72 }]}></Text>
                                    <Text style={[s.tdBold, { flex: 2 }]}>Total</Text>
                                    <Text style={[s.tdBold, { width: 32, textAlign: 'right', color: ACCENT }]}>{hrs.toFixed(1)}</Text>
                                    <Text style={[s.td, { flex: 3 }]}></Text>
                                </View>
                            </View>
                        </View>
                    );
                })}

                {/* ---- Footer ---- */}
                <View style={s.footerBar} fixed>
                    <Text style={s.footerText}>{invoice.payment.contactEmail || 'accounting@outthere.solutions'}</Text>
                    <Text style={s.footerText}>{invoice.payment.contactPhone || '647-873-4788'}</Text>
                </View>
            </Page>
        </Document>
    );
}
