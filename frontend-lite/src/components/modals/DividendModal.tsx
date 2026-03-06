"use client";

import { useMemo, useState } from "react";
import { months } from "@/lib/months";
import { currency, memberTotal } from "@/lib/format";
import { sumCollectedOverdraftInterest } from "@/lib/overdraft-service";
import type { MemberContribution, OverdraftRecord } from "@/types/funds";

type DividendModalProps = {
  open: boolean;
  onClose: () => void;
  members: MemberContribution[];
  overdrafts: OverdraftRecord[];
};

type MemberDividend = {
  id: string;
  name: string;
  totalContrib: number;
  sharePercent: number;
  dividend: number;
  totalPayout: number;
};

const monthWeights: Record<(typeof months)[number], number> = {
  January: 12,
  February: 11,
  March: 10,
  April: 9,
  May: 8,
  June: 7,
  July: 6,
  August: 5,
  September: 4,
  October: 3,
  November: 2,
  December: 1,
};

export default function DividendModal({ open, onClose, members, overdrafts }: DividendModalProps) {
  const [broughtForward, setBroughtForward] = useState<number>(0);
  const [monthlyInterest, setMonthlyInterest] = useState<number>(0);
  const [results, setResults] = useState<MemberDividend[]>([]);

  const overdraftInterest = useMemo(() => sumCollectedOverdraftInterest(overdrafts), [overdrafts]);
  const totalPool = overdraftInterest + broughtForward + monthlyInterest;

  const weightedMembers = useMemo(() => {
    const activeMembers = members.filter((member) => !member.isArchived);
    const base = activeMembers.map((member) => {
      const weightedContrib = months.reduce((sum, month) => {
        return sum + (member.contributions[month] || 0) * monthWeights[month];
      }, 0);

      return {
        member,
        weightedContrib,
        totalContrib: memberTotal(member),
      };
    });

    const totalWeightedContrib = base.reduce((sum, entry) => sum + entry.weightedContrib, 0);

    return { base, totalWeightedContrib };
  }, [members]);

  const calculate = () => {
    if (totalPool <= 0) {
      setResults([]);
      return;
    }

    const computed = weightedMembers.base
      .map(({ member, weightedContrib, totalContrib }) => {
        const shareRatio = weightedMembers.totalWeightedContrib > 0 ? weightedContrib / weightedMembers.totalWeightedContrib : 0;
        const dividend = shareRatio * totalPool;

        return {
          id: member.id,
          name: member.name,
          totalContrib,
          sharePercent: shareRatio * 100,
          dividend,
          totalPayout: totalContrib + dividend,
        } satisfies MemberDividend;
      })
      .sort((left, right) => right.totalContrib - left.totalContrib);

    setResults(computed);
  };

  return (
    <div className={`modal ${open ? "active" : ""}`} id="dividendModal">
      <div className="modal-content modal-wide">
        <div className="modal-header">
          <h3 className="modal-title">End of Year Dividend Calculation</h3>
          <button className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="modal-summary-card">
          <h4 className="modal-subtitle">Profit Breakdown</h4>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Overdraft Interest Collected</label>
              <input className="form-input form-highlight" readOnly type="text" value={currency(overdraftInterest)} />
            </div>
            <div className="form-group">
              <label className="form-label">Balance B/F</label>
              <input className="form-input" min={0} onChange={(event) => setBroughtForward(Number(event.target.value) || 0)} placeholder="0.00" step="0.01" type="number" value={broughtForward || ""} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monthly Interest (Total)</label>
              <input className="form-input" min={0} onChange={(event) => setMonthlyInterest(Number(event.target.value) || 0)} placeholder="0.00" step="0.01" type="number" value={monthlyInterest || ""} />
            </div>
          </div>

          <div className="summary-actions">
            <div className="summary-total">
              <label className="form-label">Total Distributable Dividend</label>
              <input className="form-input form-total" readOnly type="text" value={currency(totalPool)} />
            </div>
            <button className="btn btn-primary summary-btn" onClick={calculate} type="button">
              Calculate Distribution
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="results-panel">
            <div className="table-wrapper modal-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="th-right">Total Contrib.</th>
                    <th className="th-right">Share %</th>
                    <th className="th-right">Dividend</th>
                    <th className="th-right">Total Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.id}>
                      <td className="font-bold">{row.name}</td>
                      <td className="amount-cell">{currency(row.totalContrib)}</td>
                      <td className="amount-cell">{row.sharePercent.toFixed(1)}%</td>
                      <td className="amount-cell font-extra-bold text-success">{currency(row.dividend)}</td>
                      <td className="amount-cell font-extra-bold">{currency(row.totalPayout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
