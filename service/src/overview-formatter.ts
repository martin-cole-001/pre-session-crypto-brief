import type { OverviewOutput, CryptoSession } from './ports.js';

const SESSION_LABEL: Record<CryptoSession, string> = {
  ASIA_CRYPTO: 'Asia',
  EUROPE_CRYPTO: 'Europe',
  US_CRYPTO: 'US',
};

export class OverviewFormatter {
  format(output: OverviewOutput): string {
    const sessionLabel = SESSION_LABEL[output.session];
    const lines: string[] = [];

    lines.push(`${sessionLabel} Crypto Overview`);
    lines.push('');
    lines.push(`Market tone: ${output.overview.marketTone.replace(/_/g, ' ')}`);
    lines.push(output.overview.sessionRead);
    lines.push('');
    lines.push('BTC:');
    lines.push(output.btcContext.summary);
    if (output.btcContext.keyLevels.length > 0) {
      lines.push(`Key levels: ${output.btcContext.keyLevels.join(', ')}`);
    }
    lines.push(`Position: ${output.btcContext.currentPosition}`);
    lines.push('');
    lines.push('ETH:');
    lines.push(output.ethContext.summary);
    lines.push(`vs BTC: ${output.ethContext.ethVsBtc}`);
    lines.push('');
    lines.push('Alts:');
    lines.push(output.altcoinContext.summary);
    lines.push(`Rotation: ${output.altcoinContext.rotationState.replace(/_/g, ' ')}`);
    lines.push('');
    lines.push('Positioning:');
    lines.push(output.derivativesContext.summary);
    lines.push(`Funding: ${output.derivativesContext.fundingRead}`);
    lines.push(`OI: ${output.derivativesContext.oiRead}`);
    if (output.derivativesContext.positioningRead.trim() !== '') {
      lines.push(`Read: ${output.derivativesContext.positioningRead}`);
    }

    if (output.eventsContext.importantEvents.length > 0) {
      lines.push('');
      lines.push('Events:');
      lines.push(output.eventsContext.summary);
      for (const ev of output.eventsContext.importantEvents) {
        lines.push(`- [${ev.importance}] ${ev.title}: ${ev.relevance}`);
      }
    }

    if (output.assetsInFocus.length > 0) {
      lines.push('');
      lines.push('Assets in focus:');
      output.assetsInFocus.forEach((a, i) => {
        lines.push(`${i + 1}. ${a.symbol} — ${a.reason}`);
      });
    }

    if (output.setupsInFocus.length > 0) {
      lines.push('');
      lines.push('Active setups:');
      output.setupsInFocus.forEach((s) => {
        lines.push(`- ${s.symbol}: ${s.reason}`);
      });
    }

    if (output.levelsToWatch.length > 0) {
      lines.push('');
      lines.push('Levels to watch:');
      output.levelsToWatch.forEach((l) => {
        lines.push(`- ${l.symbol} ${l.levelType}: ${l.level} (${l.reason})`);
      });
    }

    if (output.sessionNotes.length > 0) {
      lines.push('');
      lines.push('Session notes:');
      output.sessionNotes.forEach((note) => lines.push(`- ${note}`));
    }

    return lines.join('\n');
  }

  splitForTelegram(report: string, maxLength = 4096): string[] {
    if (report.length <= maxLength) return [report];

    const chunks: string[] = [];
    const lines = report.split('\n');
    let current = '';

    for (const line of lines) {
      const newSection = current.length === 0 ? line : `${current}\n${line}`;
      if (newSection.length > maxLength) {
        if (current.length > 0) chunks.push(current);
        current = line;
      } else {
        current = newSection;
      }
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }
}
