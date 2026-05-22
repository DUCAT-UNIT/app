import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../theme';
import { logger } from '../utils/logger';
import { analytics } from '../services/analyticsService';
import { ERROR_EVENTS } from '../constants/analyticsEvents';
import { startupDiagnostics } from '../services/startupDiagnostics';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
  boundaryName?: string;
  extraContext?: Record<string, unknown>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error(error, {
      componentStack: errorInfo.componentStack,
      boundary: this.props.boundaryName || 'ErrorBoundary',
      ...(this.props.extraContext || {}),
    });
    analytics.track(ERROR_EVENTS.ERROR_BOUNDARY_TRIGGERED, {
      boundary_name: this.props.boundaryName || 'ErrorBoundary',
      error_message: error.message,
    });
    startupDiagnostics.recordFailure('error_boundary_triggered', {
      boundary_name: this.props.boundaryName || 'ErrorBoundary',
      error_message: error.message,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.warningBadge}>
              <Text style={styles.warningBadgeText}>!</Text>
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.props.fallbackMessage ||
                'The app encountered an unexpected error. Please try again.'}
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorStack}>{this.state.errorInfo.componentStack}</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  warningBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.WARNING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  warningBadgeText: {
    color: COLORS.WARNING,
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'CabinetGrotesk-Bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'CabinetGrotesk-Bold',
  },
  message: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  button: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 150,
  },
  buttonText: {
    color: COLORS.VERY_LIGHT_GRAY,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'CabinetGrotesk-Medium',
  },
  errorDetails: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  errorTitle: {
    color: COLORS.DANGER_RED,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'CabinetGrotesk-Bold',
  },
  errorText: {
    color: COLORS.DANGER_RED,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  errorStack: {
    color: '#999',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
